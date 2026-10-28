import type { FulfillmentRecord } from "@/lib/fulfillment";
import type { BuyerHistory } from "@/lib/source";
import type { Dispute, Tracker } from "@/lib/paypal/types";

// What a PayPal reviewer looks for, per dispute reason, checked against what is actually on file.
// Deterministic so the seller sees the same gaps the agent is told about.

export type CheckStatus = "have" | "missing" | "weak";
export type CheckItem = { label: string; status: CheckStatus; detail: string };

type Ctx = {
  dispute: Dispute;
  trackers: Tracker[];
  record: FulfillmentRecord | null;
  history: BuyerHistory | null;
  signatureThreshold: number;
};

const item = (label: string, status: CheckStatus, detail: string): CheckItem => ({ label, status, detail });

function delivery({ trackers, record }: Ctx): CheckItem[] {
  const onPayPal = trackers.find((t) => t.tracking_number);
  const delivered = trackers.some((t) => t.status === "DELIVERED") || Boolean(record?.deliveredAt);
  return [
    onPayPal
      ? item("Tracking on the PayPal transaction", "have", `${onPayPal.carrier ?? ""} ${onPayPal.tracking_number}`.trim())
      : record?.trackingNumber
        ? item("Tracking on the PayPal transaction", "weak", "In shop records but not uploaded to PayPal")
        : item("Tracking on the PayPal transaction", "missing", "Shipped without tracking"),
    delivered
      ? item("Carrier shows delivered", "have", record?.deliveredAt ? `Delivered ${record.deliveredAt.slice(0, 10)}` : "Tracker status DELIVERED")
      : item("Carrier shows delivered", "missing", "No delivery scan on file"),
  ];
}

function signature(ctx: Ctx): CheckItem {
  const amount = Number(ctx.dispute.dispute_amount.value);
  if (ctx.record?.signedBy) return item("Signature on delivery", "have", `Signed by ${ctx.record.signedBy}`);
  if (amount >= ctx.signatureThreshold) {
    return item("Signature on delivery", "missing", `Orders over $${ctx.signatureThreshold} should ship with signature; a plain delivered scan can still lose`);
  }
  return item("Signature on delivery", "weak", "Not required at this amount, but it would strengthen the case");
}

export function evidenceChecklist(ctx: Ctx): CheckItem[] {
  const { dispute, record, history } = ctx;
  const digital = dispute.disputed_transactions?.[0]?.items?.some((i) => /digital|download|license/i.test(i.item_name ?? ""));

  if (digital) {
    return [
      item("Proof the buyer accessed the item", record?.notes?.some((n) => /download|access|login/i.test(n)) ? "have" : "missing", "Download or access log with dates"),
      item("Seller Protection", "weak", "PayPal Seller Protection does not cover intangible items, so expect to rely on your own records"),
    ];
  }

  switch (dispute.reason) {
    case "MERCHANDISE_OR_SERVICE_NOT_RECEIVED":
      return [
        ...delivery(ctx),
        signature(ctx),
        item("Shipped to the address on the payment", record?.shipTo ? "have" : "missing", record?.shipTo ?? "No ship-to on file"),
      ];
    case "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED":
      return [
        ...delivery(ctx),
        item("Buyer's photo of the problem", "missing", "Ask the buyer for a photo before deciding"),
        item("Item matches the listing", "weak", "Keep listing text and product photos ready"),
        item(
          "Packing record",
          record?.notes?.some((n) => /pack|box/i.test(n)) ? "weak" : "missing",
          record?.notes?.find((n) => /pack|box/i.test(n)) ?? "No note on how the item was packed",
        ),
      ];
    case "UNAUTHORISED":
      return [
        ...delivery(ctx),
        signature(ctx),
        item("Shipped to the PayPal account address", record?.notes?.some((n) => /address/i.test(n)) ? "have" : "weak", record?.shipTo ?? "Check the ship-to"),
        history && history.orders > 0
          ? item("Prior purchases by this buyer", "have", `${history.orders} earlier order${history.orders === 1 ? "" : "s"}, $${history.totalSpent}`)
          : item("Prior purchases by this buyer", "missing", "First order from this buyer"),
      ];
    case "CREDIT_NOT_PROCESSED":
      return [
        record?.refunds?.length
          ? item("Refund ID", "have", record.refunds.map((r) => `${r.refundId} (${r.amount})`).join(", "))
          : item("Refund ID", "missing", "No refund recorded"),
        item("Return received", record?.notes?.some((n) => /return/i.test(n)) ? "have" : "missing", "Date the return arrived"),
      ];
    case "DUPLICATE_TRANSACTION":
    case "INCORRECT_AMOUNT":
      return [item("Order total matches the charge", record ? "have" : "missing", record ? `Order total $${record.total}` : "No order record")];
    default:
      return [...delivery(ctx)];
  }
}
