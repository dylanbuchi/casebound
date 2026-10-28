import type { DisputeReason, DisputeStatus, Money } from "@/lib/paypal/types";

export const reasonLabel: Record<DisputeReason, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorized payment",
  CREDIT_NOT_PROCESSED: "Refund not processed",
  DUPLICATE_TRANSACTION: "Duplicate charge",
  INCORRECT_AMOUNT: "Incorrect amount",
  PAYMENT_BY_OTHER_MEANS: "Paid by other means",
  CANCELED_RECURRING_BILLING: "Canceled subscription",
  PROBLEM_WITH_REMITTANCE: "Remittance problem",
  OTHER: "Other",
};

export const statusLabel = (s: DisputeStatus | string) =>
  ({
    OPEN: "Open",
    WAITING_FOR_SELLER_RESPONSE: "Needs your response",
    WAITING_FOR_BUYER_RESPONSE: "Waiting on buyer",
    UNDER_REVIEW: "PayPal reviewing",
    RESOLVED: "Resolved",
    OTHER: "Other",
  })[s] ?? s;

export const fmtMoney = (m: Money | { value: number; currency_code: string }) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency_code }).format(Number(m.value));

export const fmtUsd = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";

export function daysUntil(iso?: string) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export const verdictColor = {
  FIGHT: "text-fight",
  ACCEPT: "text-accept",
  OFFER: "text-offer",
} as const;

// Share of the response window already used, 0..1.
export function windowUsed(createdIso: string, dueIso?: string) {
  if (!dueIso) return 0;
  const start = new Date(createdIso).getTime();
  const total = new Date(dueIso).getTime() - start;
  return total > 0 ? Math.min(1, Math.max(0, (Date.now() - start) / total)) : 0;
}
