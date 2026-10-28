import "server-only";
import { evidenceChecklist } from "@/lib/checklist";
import { isQuickCall } from "@/lib/economics";
import { merchant } from "@/lib/merchant";
import type { Dispute, Tracker } from "@/lib/paypal/types";
import type { FulfillmentRecord } from "@/lib/fulfillment";
import type { Source } from "@/lib/source";

export const econBaseFor = (dispute: Pick<Dispute, "dispute_amount">) => ({
  amount: Number(dispute.dispute_amount.value),
  disputeFee: merchant.disputeFee,
  minutesToRespond: merchant.minutesWithDraft,
  hourlyRate: merchant.hourlyRate,
});

export const quickCallFor = (dispute: Pick<Dispute, "dispute_amount">) => isQuickCall(econBaseFor(dispute));

export async function checklistFor(src: Source, dispute: Dispute, trackers: Tracker[], record: FulfillmentRecord | null) {
  // Only the unauthorized-payment checklist uses history, and in live mode it costs several PayPal calls.
  const history =
    record && dispute.reason === "UNAUTHORISED"
      ? await src.getBuyerHistory(record.buyerEmail, record.orderId).catch(() => null)
      : null;
  return evidenceChecklist({ dispute, trackers, record, history, signatureThreshold: merchant.signatureThreshold });
}

export const QUICK_ACCEPT_MESSAGE =
  "Hi, thanks for flagging this. We've accepted your claim and PayPal will refund you the full amount. Sorry for the trouble.";
