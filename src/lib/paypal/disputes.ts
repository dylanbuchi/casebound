import "server-only";
import { paypal } from "./client";
import type { Capture, Dispute, DisputeSummary, EvidenceInput, Money, OfferType, OrderSummary, Tracker } from "./types";

export async function listDisputes(): Promise<DisputeSummary[]> {
  const res = await paypal<{ items?: DisputeSummary[] }>("/v1/customer/disputes", {
    query: { page_size: "50" },
  });
  return res.items ?? [];
}

export const getDispute = (id: string) => paypal<Dispute>(`/v1/customer/disputes/${encodeURIComponent(id)}`);

export const getCapture = (captureId: string) =>
  paypal<Capture>(`/v2/payments/captures/${encodeURIComponent(captureId)}`);

export const getOrder = (orderId: string) => paypal<OrderSummary>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);

// Order trackers have ids of the form "<capture id>-<tracking number>".
export function trackersFromOrder(order: OrderSummary | null, captureId: string): Tracker[] {
  return (order?.purchase_units?.[0]?.shipping?.trackers ?? [])
    .filter((t) => t.id.startsWith(`${captureId}-`))
    .map((t) => ({ transaction_id: captureId, tracking_number: t.id.slice(captureId.length + 1), status: t.status }));
}

// The capture links back to its order with rel "up".
export function orderIdFromCapture(capture: Capture): string | undefined {
  const up = capture.links?.find((l) => l.rel === "up")?.href;
  return up?.split("/").pop();
}

// provide-evidence is multipart: a JSON "input" part plus optional files.
export async function provideEvidence(disputeId: string, evidences: EvidenceInput[], requestId: string) {
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify({ evidences })], { type: "application/json" }));
  return paypal(`/v1/customer/disputes/${encodeURIComponent(disputeId)}/provide-evidence`, {
    method: "POST",
    form,
    requestId,
  });
}

// While PayPal reviews a case, the seller can still add notes (multipart, JSON "input" part).
export async function provideSupportingInfo(disputeId: string, notes: string, requestId: string) {
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify({ notes })], { type: "application/json" }));
  return paypal(`/v1/customer/disputes/${encodeURIComponent(disputeId)}/provide-supporting-info`, {
    method: "POST",
    form,
    requestId,
  });
}

export const acceptClaim = (disputeId: string, note: string, requestId: string) =>
  paypal(`/v1/customer/disputes/${encodeURIComponent(disputeId)}/accept-claim`, {
    method: "POST",
    json: { note },
    requestId,
  });

export const makeOffer = (
  disputeId: string,
  note: string,
  offer: Money | null,
  offerType: OfferType,
  requestId: string,
) =>
  paypal(`/v1/customer/disputes/${encodeURIComponent(disputeId)}/make-offer`, {
    method: "POST",
    json: { note, offer_type: offerType, ...(offer ? { offer_amount: offer } : {}) },
    requestId,
  });

export const sendMessage = (disputeId: string, message: string, requestId: string) =>
  paypal(`/v1/customer/disputes/${encodeURIComponent(disputeId)}/send-message`, {
    method: "POST",
    json: { message },
    requestId,
  });
