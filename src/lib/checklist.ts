import type { FulfillmentRecord } from "@/lib/fulfillment";
import type { BuyerHistory } from "@/lib/source";
import type { Dispute, Tracker } from "@/lib/paypal/types";

// What a PayPal reviewer looks for, per dispute reason, checked against what is actually on file.
// Deterministic so the seller sees the same gaps the agent is told about.

export type CheckStatus = "have" | "missing" | "weak";
// Where the fact comes from. Shop records are the seller's own claims; PayPal and the carrier are independent.
export type CheckSource = "PayPal" | "Shop record" | "Dispute" | "Policy";
export type CheckItem = { label: string; status: CheckStatus; detail: string; source: CheckSource; conflict?: boolean };

type Ctx = {
  dispute: Dispute;
  trackers: Tracker[];
  record: FulfillmentRecord | null;
  history: BuyerHistory | null;
  signatureThreshold: number;
};

const item = (label: string, status: CheckStatus, detail: string, source: CheckSource, conflict = false): CheckItem => ({
  label,
  status,
  detail,
  source,
  ...(conflict ? { conflict } : {}),
});

const carrierConfirmed = ({ trackers }: Ctx) => trackers.some((t) => t.status === "DELIVERED");
// Tracker states that say the parcel did not reach the buyer. Anything else (often SHIPPED, which sandbox
// tracking never moves past) is just unconfirmed, not a contradiction of the shop's delivery date.
const NOT_DELIVERED = new Set(["RETURNED", "INRETURN", "CANCELLED", "VOID", "DELIVERY_FAILED", "NOT_SHIPPED"]);

function delivery(ctx: Ctx): CheckItem[] {
  const { trackers, record } = ctx;
  const onPayPal = trackers.find((t) => t.tracking_number);
  const tracking = onPayPal
    ? item("Tracking on the PayPal transaction", "have", `${onPayPal.carrier ?? ""} ${onPayPal.tracking_number}`.trim(), "PayPal")
    : record?.trackingNumber
      ? item("Tracking on the PayPal transaction", "weak", "In shop records but not uploaded to PayPal", "Shop record")
      : item("Tracking on the PayPal transaction", "missing", "Shipped without tracking", "Shop record");

  // Only PayPal's tracker counts as carrier proof. A shop "delivered" date alone is the seller's own claim.
  let delivered: CheckItem;
  if (carrierConfirmed(ctx)) {
    delivered = item("Delivery confirmed by the carrier", "have", "PayPal tracking shows DELIVERED", "PayPal");
  } else if (record?.deliveredAt) {
    const status = onPayPal?.status ?? "no status";
    delivered = item(
      "Delivery confirmed by the carrier",
      "weak",
      `Only the shop record says delivered (${record.deliveredAt.slice(0, 10)}); PayPal tracking shows ${status}. Verify with the carrier before relying on it.`,
      "Shop record",
      trackers.some((t) => NOT_DELIVERED.has(t.status ?? "")),
    );
  } else {
    delivered = item("Delivery confirmed by the carrier", "missing", "No delivery scan on file", "PayPal");
  }
  return [tracking, delivered];
}

function signature(ctx: Ctx): CheckItem {
  const amount = Number(ctx.dispute.dispute_amount.value);
  if (ctx.record?.signedBy) {
    return carrierConfirmed(ctx)
      ? item("Signature on delivery", "have", `Signed by ${ctx.record.signedBy}`, "Shop record")
      : item("Signature on delivery", "weak", `Shop record says signed by ${ctx.record.signedBy}; no carrier confirmation yet`, "Shop record");
  }
  if (amount >= ctx.signatureThreshold) {
    return item("Signature on delivery", "missing", `Orders over $${ctx.signatureThreshold} should ship with signature; a plain delivered scan can still lose`, "Policy");
  }
  return item("Signature on delivery", "weak", "Not required at this amount, but it would strengthen the case", "Policy");
}

export function evidenceChecklist(ctx: Ctx): CheckItem[] {
  const { dispute, record, history } = ctx;
  const digital = dispute.disputed_transactions?.[0]?.items?.some((i) => /digital|download|license/i.test(i.item_name ?? ""));

  if (digital) {
    return [
      item("Proof the buyer accessed the item", record?.notes?.some((n) => /download|access|login/i.test(n)) ? "have" : "missing", "Download or access log with dates", "Shop record"),
      item("Seller Protection", "weak", "PayPal Seller Protection does not cover intangible items, so expect to rely on your own records", "Policy"),
    ];
  }

  switch (dispute.reason) {
    case "MERCHANDISE_OR_SERVICE_NOT_RECEIVED":
      return [
        ...delivery(ctx),
        signature(ctx),
        item("Shipped to the address on the payment", record?.shipTo ? "have" : "missing", record?.shipTo ?? "No ship-to on file", "Shop record"),
      ];
    case "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED":
      return [
        ...delivery(ctx),
        item("Buyer's photo of the problem", "missing", "Ask the buyer for a photo before deciding", "Dispute"),
        item("Item matches the listing", "weak", "Keep listing text and product photos ready", "Shop record"),
        item(
          "Packing record",
          record?.notes?.some((n) => /pack|box/i.test(n)) ? "weak" : "missing",
          record?.notes?.find((n) => /pack|box/i.test(n)) ?? "No note on how the item was packed",
          "Shop record",
        ),
      ];
    case "UNAUTHORISED":
      return [
        ...delivery(ctx),
        signature(ctx),
        item("Shipped to the PayPal account address", record?.notes?.some((n) => /address/i.test(n)) ? "have" : "weak", record?.shipTo ?? "Check the ship-to", "Shop record"),
        history && history.orders > 0
          ? item("Prior purchases by this buyer", "have", `${history.orders} earlier order${history.orders === 1 ? "" : "s"}, $${history.totalSpent}`, "Shop record")
          : item("Prior purchases by this buyer", "missing", "First order from this buyer", "Shop record"),
      ];
    case "CREDIT_NOT_PROCESSED":
      return [
        record?.refunds?.length
          ? item("Refund ID", "have", record.refunds.map((r) => `${r.refundId} (${r.amount})`).join(", "), "Shop record")
          : item("Refund ID", "missing", "No refund recorded", "Shop record"),
        item("Return received", record?.notes?.some((n) => /return/i.test(n)) ? "have" : "missing", "Date the return arrived", "Shop record"),
      ];
    case "DUPLICATE_TRANSACTION":
    case "INCORRECT_AMOUNT":
      return [item("Order total matches the charge", record ? "have" : "missing", record ? `Order total $${record.total}` : "No order record", "Shop record")];
    default:
      return [...delivery(ctx)];
  }
}

// Facts that contradict each other, to show where the seller decides.
export const conflictsIn = (items: CheckItem[]) => items.filter((i) => i.conflict);
