import type { Dispute, DisputeSummary } from "@/lib/paypal/types";

// What the seller may do right now. PayPal says so through the dispute's links;
// demo fixtures have no links, so they fall back to the status.

export type ActionKind = "provide_evidence" | "provide_supporting_info" | "accept_claim" | "make_offer" | "send_message";

const ALL: ActionKind[] = ["provide_evidence", "accept_claim", "make_offer", "send_message"];

export function allowedActions(d: Dispute): Set<ActionKind> {
  if (!d.links) return new Set(d.status === "WAITING_FOR_SELLER_RESPONSE" || d.status === "OPEN" ? ALL : []);
  const rels = new Set(d.links.map((l) => l.rel));
  return new Set(
    (["provide_evidence", "provide_supporting_info", "accept_claim", "make_offer", "send_message"] as const).filter((k) =>
      rels.has(k),
    ),
  );
}

// List summaries carry no links, so the inbox uses the status.
export const needsSellerResponse = (d: Pick<DisputeSummary, "status">) =>
  d.status === "WAITING_FOR_SELLER_RESPONSE" || d.status === "OPEN";
