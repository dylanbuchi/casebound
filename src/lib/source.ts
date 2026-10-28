import "server-only";
import { isLive } from "@/lib/env";
import { demoFixtures } from "@/lib/demo/fixtures";
import { findFulfillment, listFulfillment, type FulfillmentRecord } from "@/lib/fulfillment";
import * as pp from "@/lib/paypal/disputes";
import type { Dispute, DisputeSummary, EvidenceInput, Money, OfferType, OrderSummary, Tracker, Capture } from "@/lib/paypal/types";
import { readJson, updateJson } from "@/lib/store";

// One interface over two backends: bundled fixtures (demo) and the PayPal sandbox (live).

export type PaymentContext = { capture: Capture | null; order: OrderSummary | null };

export type BuyerHistory = {
  email: string;
  orders: number;
  totalSpent: number;
  firstOrderAt: string | null;
  priorDisputes: number;
};

export type DisputeAction =
  | { kind: "provide_evidence"; evidences: EvidenceInput[] }
  | { kind: "provide_supporting_info"; notes: string }
  | { kind: "accept_claim"; note: string }
  | { kind: "make_offer"; note: string; amount: Money | null; offerType: OfferType }
  | { kind: "send_message"; message: string };

export interface Source {
  mode: "demo" | "live";
  listDisputes(): Promise<DisputeSummary[]>;
  getDispute(id: string): Promise<Dispute>;
  getPayment(dispute: Dispute): Promise<PaymentContext>;
  getTrackers(dispute: Dispute): Promise<Tracker[]>;
  getFulfillment(dispute: Dispute): Promise<FulfillmentRecord | null>;
  getBuyerHistory(email: string, excludeOrderId?: string): Promise<BuyerHistory>;
  // Returns PayPal's response body (demo mode returns a simulated one).
  act(disputeId: string, action: DisputeAction, requestId: string): Promise<unknown>;
}

const captureIdOf = (d: Dispute) => d.disputed_transactions?.[0]?.seller_transaction_id;

async function historyFrom(records: FulfillmentRecord[], email: string, excludeOrderId?: string, disputes = 0) {
  const mine = records.filter((r) => r.buyerEmail.toLowerCase() === email.toLowerCase() && r.orderId !== excludeOrderId);
  const dates = mine.map((r) => r.createdAt).sort();
  return {
    email,
    orders: mine.length,
    totalSpent: Math.round(mine.reduce((s, r) => s + Number(r.total), 0) * 100) / 100,
    firstOrderAt: dates[0] ?? null,
    priorDisputes: disputes,
  } satisfies BuyerHistory;
}

// Demo state survives restarts so a recorded walkthrough stays consistent.
type DemoState = Record<string, { status: Dispute["status"]; evidences?: Dispute["evidences"]; messages?: Dispute["messages"]; outcome?: Dispute["outcome"] }>;

const demo: Source = {
  mode: "demo",
  async listDisputes() {
    return Promise.all(demoFixtures.map((f) => demo.getDispute(f.dispute.dispute_id)));
  },
  async getDispute(id) {
    const f = demoFixtures.find((x) => x.dispute.dispute_id === id);
    if (!f) throw new Error("Dispute not found");
    const state = (await readJson<DemoState>("demo-state", {}))[id];
    if (!state) return f.dispute;
    return {
      ...f.dispute,
      status: state.status,
      evidences: state.evidences ?? f.dispute.evidences,
      messages: [...(f.dispute.messages ?? []), ...(state.messages ?? [])],
      outcome: state.outcome,
    };
  },
  async getPayment(d) {
    const f = demoFixtures.find((x) => x.dispute.dispute_id === d.dispute_id)!;
    const amount = d.dispute_amount;
    return {
      capture: { id: f.fulfillment.captureId, status: "COMPLETED", amount, create_time: f.fulfillment.createdAt },
      order: {
        id: f.fulfillment.orderId,
        status: "COMPLETED",
        create_time: f.fulfillment.createdAt,
        payer: { email_address: f.fulfillment.buyerEmail },
        purchase_units: [
          {
            amount,
            items: f.fulfillment.items.map((i) => ({
              name: i.name,
              quantity: String(i.quantity),
              unit_amount: { currency_code: amount.currency_code, value: i.unitPrice },
            })),
          },
        ],
      },
    };
  },
  async getTrackers(d) {
    return demoFixtures.find((x) => x.dispute.dispute_id === d.dispute_id)?.trackers ?? [];
  },
  async getFulfillment(d) {
    return demoFixtures.find((x) => x.dispute.dispute_id === d.dispute_id)?.fulfillment ?? null;
  },
  async getBuyerHistory(email, excludeOrderId) {
    // The chargeback buyer in fixture 4 is a returning customer; that history is part of the story.
    const extra: FulfillmentRecord[] =
      email === "morgan.lee@example.com"
        ? [1, 2, 3].map((i) => ({
            orderId: `DEMO-HIST-${i}`,
            captureId: `DEMO-HIST-CAP-${i}`,
            createdAt: new Date(Date.now() - (60 + i * 45) * 86_400_000).toISOString(),
            buyerName: "Morgan Lee",
            buyerEmail: email,
            shipTo: "Denver, CO, US",
            items: [],
            total: ["42.00", "68.00", "51.00"][i - 1],
          }))
        : [];
    return historyFrom([...demoFixtures.map((f) => f.fulfillment), ...extra], email, excludeOrderId);
  },
  async act(id, action) {
    const now = new Date().toISOString();
    const updated = await updateJson<DemoState>("demo-state", {}, (all) => {
      const cur = all[id] ?? { status: "WAITING_FOR_SELLER_RESPONSE" as const };
      switch (action.kind) {
        case "provide_supporting_info":
          return {
            ...all,
            [id]: { ...cur, status: "UNDER_REVIEW", evidences: [{ evidence_type: "OTHER", notes: action.notes, date: now }] },
          };
        case "provide_evidence":
          return {
            ...all,
            [id]: {
              ...cur,
              status: "UNDER_REVIEW",
              evidences: action.evidences.map((e) => ({ evidence_type: e.evidence_type, notes: e.notes, date: now })),
            },
          };
        case "accept_claim":
          return { ...all, [id]: { ...cur, status: "RESOLVED", outcome: { outcome_code: "RESOLVED_BUYER_FAVOUR" } } };
        case "make_offer":
        case "send_message": {
          const content = action.kind === "make_offer" ? `${action.note} (Offer: ${action.amount ? `${action.amount.value} ${action.amount.currency_code}` : "replacement"})` : action.message;
          return {
            ...all,
            [id]: {
              ...cur,
              status: action.kind === "make_offer" ? "WAITING_FOR_BUYER_RESPONSE" : cur.status,
              messages: [...(cur.messages ?? []), { posted_by: "SELLER", time_posted: now, content }],
            },
          };
        }
      }
    });
    return { simulated: true, dispute_id: id, status: updated[id]?.status };
  },
};

const live: Source = {
  mode: "live",
  listDisputes: pp.listDisputes,
  getDispute: pp.getDispute,
  async getPayment(d) {
    const captureId = captureIdOf(d);
    if (!captureId) return { capture: null, order: null };
    const capture = await pp.getCapture(captureId).catch(() => null);
    const orderId = capture ? pp.orderIdFromCapture(capture) : undefined;
    const order = orderId ? await pp.getOrder(orderId).catch(() => null) : null;
    return { capture, order };
  },
  async getTrackers(d) {
    const captureId = captureIdOf(d);
    if (!captureId) return [];
    const { order } = await live.getPayment(d);
    const record = await findFulfillment({ captureId });
    // Carrier is not echoed on order trackers; the shop record knows it.
    return pp.trackersFromOrder(order, captureId).map((t) => ({
      ...t,
      carrier: record && record.trackingNumber?.replaceAll(" ", "") === t.tracking_number ? record.carrier : undefined,
    }));
  },
  async getFulfillment(d) {
    return findFulfillment({ captureId: captureIdOf(d) });
  },
  async getBuyerHistory(email, excludeOrderId) {
    const disputes = await pp.listDisputes().catch(() => []);
    // Dispute summaries carry no buyer email, so count only those tied to this buyer's shop orders.
    const records = await listFulfillment();
    const buyerCaptures = new Set(records.filter((r) => r.buyerEmail.toLowerCase() === email.toLowerCase()).map((r) => r.captureId));
    let prior = 0;
    for (const s of disputes.slice(0, 20)) {
      const full = await pp.getDispute(s.dispute_id).catch(() => null);
      const cap = full && captureIdOf(full);
      if (cap && buyerCaptures.has(cap)) prior++;
    }
    return historyFrom(records, email, excludeOrderId, Math.max(0, prior - 1));
  },
  async act(id, action, requestId) {
    switch (action.kind) {
      case "provide_evidence":
        return pp.provideEvidence(id, action.evidences, requestId);
      case "provide_supporting_info":
        return pp.provideSupportingInfo(id, action.notes, requestId);
      case "accept_claim":
        return pp.acceptClaim(id, action.note, requestId);
      case "make_offer":
        return pp.makeOffer(id, action.note, action.amount, action.offerType, requestId);
      case "send_message":
        return pp.sendMessage(id, action.message, requestId);
    }
  },
};

// Practice cases: a couple of bundled fixtures shown next to the real sandbox disputes, so a
// visitor can always run the decide-and-approve flow. Their sends are simulated, never sent to PayPal.
export const PRACTICE_IDS = ["PP-D-DEMO-1", "PP-D-DEMO-6"];
export const isPractice = (id: string) => id.startsWith("PP-D-DEMO-");

const pick = (id: string): Source => (isPractice(id) ? demo : live);

const withPractice: Source = {
  mode: "live",
  async listDisputes() {
    const [real, practice] = await Promise.all([
      live.listDisputes(),
      Promise.all(PRACTICE_IDS.map((id) => demo.getDispute(id))),
    ]);
    return [...practice, ...real];
  },
  getDispute: (id) => pick(id).getDispute(id),
  getPayment: (d) => pick(d.dispute_id).getPayment(d),
  getTrackers: (d) => pick(d.dispute_id).getTrackers(d),
  getFulfillment: (d) => pick(d.dispute_id).getFulfillment(d),
  // Buyer history is looked up by email; practice buyers use example.com addresses.
  getBuyerHistory: (email, excludeOrderId) =>
    (email.endsWith("@example.com") ? demo : live).getBuyerHistory(email, excludeOrderId),
  act: (id, action, requestId) => pick(id).act(id, action, requestId),
};

export const modeOf = (id: string): "demo" | "live" => (isLive() && !isPractice(id) ? "live" : "demo");

export const source = (): Source => (isLive() ? withPractice : demo);
