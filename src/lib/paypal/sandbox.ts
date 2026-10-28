import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { paypal } from "./client";
import type { DisputeReason, Money } from "./types";

// Sandbox-only test tooling: opens a dispute as the buyer, so demo cases can be
// seeded from real sandbox payments without clicking through the Resolution Center.
// Uses the app's disputes/create scope and a PayPal-Auth-Assertion naming the buyer.

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

function buyerAssertion(buyerEmail: string) {
  // Unsigned assertion, as PayPal documents for sandbox buyer-side calls.
  return `${b64url({ alg: "none" })}.${b64url({ iss: env.paypalClientId, email: buyerEmail })}.`;
}

export type SandboxDisputeReason = Extract<
  DisputeReason,
  "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" | "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"
>;

export function createSandboxDispute(input: {
  buyerEmail: string;
  sellerTransactionId: string;
  reason: SandboxDisputeReason;
  amount: Money;
  message: string;
}) {
  const form = new FormData();
  const body = {
    disputed_transactions: [{ seller_transaction_id: input.sellerTransactionId }],
    reason: input.reason,
    dispute_amount: input.amount,
    messages: [{ content: input.message }],
  };
  form.append("input", new Blob([JSON.stringify(body)], { type: "application/json" }));
  return paypal<{ links?: { href: string; rel: string }[] }>("/v1/customer/disputes", {
    method: "POST",
    form,
    requestId: randomUUID(),
    headers: { "PayPal-Auth-Assertion": buyerAssertion(input.buyerEmail) },
  });
}
