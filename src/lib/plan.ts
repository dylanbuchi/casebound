import type { Assessment } from "@/lib/agent";
import type { FulfillmentRecord } from "@/lib/fulfillment";
import type { Dispute, EvidenceInput } from "@/lib/paypal/types";
import { allowedActions, type ActionKind } from "@/lib/dispute-state";
import type { DisputeAction } from "@/lib/source";

// Turns the agent's recommendation into the exact PayPal calls the seller approves.
// Tracking numbers and refund IDs come from shop records, never from model output.

const PAYPAL_CARRIERS: Record<string, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FEDEX",
  dhl: "DHL",
  "royal mail": "ROYAL_MAIL",
};

export function carrierCode(name: string) {
  return PAYPAL_CARRIERS[name.trim().toLowerCase()] ?? "OTHER";
}

export type PlannedStep = { label: string; action: DisputeAction };

export const STALE_MESSAGE = "The dispute changed on PayPal since this analysis. Re-analyze before sending.";

// An analysis is only sendable against the dispute it read. Any change on PayPal (a buyer message, a new status,
// our own earlier send) moves update_time, which also stops a second send after a re-analysis.
export const isStale = (analysisUpdatedAt: string | undefined, dispute: Dispute) => (analysisUpdatedAt ?? "") !== dispute.update_time;

// Why a recommended offer cannot be sent as it stands, or null. An offer never falls back to another action:
// the verdict says OFFER, so Approve must not quietly send evidence instead.
export function offerProblem(dispute: Dispute, a: Assessment, allowed: Set<ActionKind> = allowedActions(dispute)): string | null {
  if (a.recommended_action !== "OFFER") return null;
  if (!allowed.has("make_offer")) return "PayPal is not accepting an offer on this dispute right now, so there is nothing to send.";
  if (!a.offer_type) return "The recommendation has no offer type, so it cannot be sent. Re-run the analysis or answer in PayPal.";
  if (a.offer_type === "REPLACEMENT_WITHOUT_REFUND") return null;
  if (!(Number(a.offer_amount) > 0)) return "The recommended offer has no amount above zero, so it cannot be sent. Re-run the analysis or answer in PayPal.";
  return null;
}

export function planActions(
  dispute: Dispute,
  a: Assessment,
  f: FulfillmentRecord | null,
  allowed: Set<ActionKind> = allowedActions(dispute),
): PlannedStep[] {
  const currency = dispute.dispute_amount.currency_code;
  const steps: PlannedStep[] = [];

  if (a.recommended_action === "ACCEPT") {
    if (!allowed.has("accept_claim")) return steps;
    steps.push({
      label: `Accept the claim and refund ${dispute.dispute_amount.value} ${currency}`,
      action: { kind: "accept_claim", note: a.buyer_message.slice(0, 2000) },
    });
    return steps;
  }

  if (a.recommended_action === "OFFER") {
    if (offerProblem(dispute, a, allowed) || !a.offer_type) return steps;
    const replacementOnly = a.offer_type === "REPLACEMENT_WITHOUT_REFUND";
    const capped = Math.max(0, Math.min(a.offer_amount ?? 0, Number(dispute.dispute_amount.value)));
    steps.push({
      label: replacementOnly
        ? "Offer a free replacement"
        : `Offer ${capped.toFixed(2)} ${currency} (${a.offer_type.replaceAll("_", " ").toLowerCase()})`,
      action: {
        kind: "make_offer",
        note: a.buyer_message.slice(0, 2000),
        amount: replacementOnly ? null : { currency_code: currency, value: capped.toFixed(2) },
        offerType: a.offer_type,
      },
    });
    return steps;
  }

  const evidence: EvidenceInput = { evidence_type: a.evidence_type ?? "OTHER", notes: a.evidence_notes.slice(0, 2000) };
  if (evidence.evidence_type === "PROOF_OF_FULFILLMENT" && f?.trackingNumber && f.carrier) {
    const code = carrierCode(f.carrier);
    evidence.evidence_info = {
      tracking_info: [
        {
          carrier_name: code,
          ...(code === "OTHER" ? { carrier_name_other: f.carrier } : {}),
          tracking_number: f.trackingNumber.replaceAll(" ", ""),
        },
      ],
    };
  } else if (evidence.evidence_type === "PROOF_OF_REFUND" && f?.refunds?.length) {
    evidence.evidence_info = { refund_ids: f.refunds.map((r) => ({ refund_id: r.refundId })) };
  } else if (evidence.evidence_type !== "OTHER") {
    // The claimed proof is not on file, so send it as notes rather than an empty proof.
    evidence.evidence_type = "OTHER";
  }

  if (allowed.has("provide_evidence")) {
    steps.push({ label: "Send evidence to PayPal", action: { kind: "provide_evidence", evidences: [evidence] } });
  } else if (allowed.has("provide_supporting_info")) {
    // Under PayPal review only notes are accepted, so the proof goes in as text.
    const proof = evidence.evidence_info?.tracking_info?.[0]
      ? `Tracking: ${evidence.evidence_info.tracking_info[0].carrier_name} ${evidence.evidence_info.tracking_info[0].tracking_number}. `
      : evidence.evidence_info?.refund_ids?.length
        ? `Refund ID: ${evidence.evidence_info.refund_ids.map((r) => r.refund_id).join(", ")}. `
        : "";
    steps.push({
      label: "Send supporting information to PayPal",
      action: { kind: "provide_supporting_info", notes: `${proof}${evidence.notes}`.slice(0, 2000) },
    });
  }
  if (a.buyer_message.trim() && allowed.has("send_message")) {
    steps.push({ label: "Message the buyer", action: { kind: "send_message", message: a.buyer_message.slice(0, 2000) } });
  }
  return steps;
}

// The exact HTTP request each action sends to PayPal, for the approval preview and the receipt log.
export type RequestPreview = { method: "POST"; path: string; contentType: string; body: unknown };

export function describeRequest(disputeId: string, action: DisputeAction): RequestPreview {
  const base = `/v1/customer/disputes/${disputeId}`;
  switch (action.kind) {
    case "provide_evidence":
      return { method: "POST", path: `${base}/provide-evidence`, contentType: "multipart/form-data (input part)", body: { evidences: action.evidences } };
    case "provide_supporting_info":
      return { method: "POST", path: `${base}/provide-supporting-info`, contentType: "multipart/form-data (input part)", body: { notes: action.notes } };
    case "accept_claim":
      return { method: "POST", path: `${base}/accept-claim`, contentType: "application/json", body: { note: action.note } };
    case "make_offer":
      return {
        method: "POST",
        path: `${base}/make-offer`,
        contentType: "application/json",
        body: { note: action.note, offer_type: action.offerType, ...(action.amount ? { offer_amount: action.amount } : {}) },
      };
    case "send_message":
      return { method: "POST", path: `${base}/send-message`, contentType: "application/json", body: { message: action.message } };
  }
}

// Applies the seller's edited wording to a planned action.
export function withEdits(action: DisputeAction, edits: { evidenceNotes: string; buyerMessage: string }): DisputeAction {
  switch (action.kind) {
    case "provide_evidence":
      return { ...action, evidences: action.evidences.map((e) => ({ ...e, notes: edits.evidenceNotes.slice(0, 2000) })) };
    case "provide_supporting_info": {
      // Keep the proof prefix built from shop records; only the seller's wording changes.
      const prefix = action.notes.match(/^(?:Tracking|Refund ID): [^.]*\. /)?.[0] ?? "";
      return { ...action, notes: `${prefix}${edits.evidenceNotes}`.slice(0, 2000) };
    }
    case "accept_claim":
    case "make_offer":
      return { ...action, note: edits.buyerMessage.slice(0, 2000) };
    case "send_message":
      return { ...action, message: edits.buyerMessage.slice(0, 2000) };
  }
}
