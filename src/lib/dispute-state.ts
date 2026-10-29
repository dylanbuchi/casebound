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

// How a resolved dispute ended for the seller, from PayPal's outcome code. Unknown codes stay neutral.
export type Outcome = { sellerKept: boolean | null; title: string; pill: string };
export function outcomeOf(code: string | undefined): Outcome {
  switch (code) {
    case "RESOLVED_SELLER_FAVOUR":
      return { sellerKept: true, title: "Won: PayPal decided for you", pill: "won" };
    case "DENIED":
      return { sellerKept: true, title: "Won: PayPal denied the claim", pill: "claim denied" };
    case "CANCELED_BY_BUYER":
      return { sellerKept: true, title: "Closed: the buyer cancelled the claim", pill: "buyer cancelled" };
    case "RESOLVED_WITH_PAYOUT":
      return { sellerKept: true, title: "Closed: PayPal paid the buyer itself", pill: "PayPal paid buyer" };
    case "RESOLVED_BUYER_FAVOUR":
    case "ACCEPTED":
      return { sellerKept: false, title: "Closed in the buyer's favour", pill: "resolved for buyer" };
    default:
      return { sellerKept: null, title: "Closed", pill: "closed" };
  }
}
