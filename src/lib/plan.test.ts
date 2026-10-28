import { describe, expect, it } from "vitest";
import type { Assessment } from "./agent";
import type { FulfillmentRecord } from "./fulfillment";
import type { Dispute } from "./paypal/types";
import { planActions } from "./plan";

const dispute = {
  dispute_id: "PP-D-1",
  create_time: "",
  update_time: "",
  reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
  status: "WAITING_FOR_SELLER_RESPONSE",
  dispute_amount: { currency_code: "USD", value: "95.00" },
} satisfies Dispute;

const base: Assessment = {
  summary: "",
  buyer_claim: "",
  key_facts: [],
  missing_evidence: [],
  win_probability: 0.8,
  win_probability_reasoning: "",
  recommended_action: "FIGHT",
  action_reasoning: "",
  offer_amount: null,
  offer_type: null,
  evidence_type: "PROOF_OF_FULFILLMENT",
  evidence_notes: "Delivered and signed.",
  buyer_message: "Hi there",
  risk_flags: [],
};

const record = {
  orderId: "O1",
  captureId: "C1",
  createdAt: "",
  buyerName: "",
  buyerEmail: "",
  shipTo: "",
  items: [],
  total: "95.00",
  carrier: "USPS",
  trackingNumber: "9400 1112 0206",
} satisfies FulfillmentRecord;

describe("planActions", () => {
  it("takes tracking from shop records, not model text", () => {
    const [evidence, message] = planActions(dispute, base, record);
    expect(evidence.action).toEqual({
      kind: "provide_evidence",
      evidences: [
        {
          evidence_type: "PROOF_OF_FULFILLMENT",
          notes: "Delivered and signed.",
          evidence_info: { tracking_info: [{ carrier_name: "USPS", tracking_number: "940011120206" }] },
        },
      ],
    });
    expect(message.action.kind).toBe("send_message");
  });

  it("downgrades a claimed proof that is not on file", () => {
    const [evidence] = planActions(dispute, base, { ...record, trackingNumber: undefined });
    expect(evidence.action).toMatchObject({ evidences: [{ evidence_type: "OTHER" }] });
  });

  it("caps an offer at the disputed amount", () => {
    const [offer] = planActions(dispute, { ...base, recommended_action: "OFFER", offer_amount: 500, offer_type: "REFUND" }, record);
    expect(offer.action).toMatchObject({ kind: "make_offer", amount: { value: "95.00" } });
  });

  it("accepting is a single refund step", () => {
    const steps = planActions(dispute, { ...base, recommended_action: "ACCEPT" }, record);
    expect(steps.map((s) => s.action.kind)).toEqual(["accept_claim"]);
  });
});

describe("replacement offers", () => {
  it("sends a replacement without an amount", () => {
    const [offer] = planActions(
      dispute,
      { ...base, recommended_action: "OFFER", offer_amount: 0, offer_type: "REPLACEMENT_WITHOUT_REFUND" },
      record,
    );
    expect(offer.action).toMatchObject({ kind: "make_offer", amount: null, offerType: "REPLACEMENT_WITHOUT_REFUND" });
  });
});

describe("PayPal-allowed actions", () => {
  const withLinks = (rels: string[]): Dispute => ({ ...dispute, status: "UNDER_REVIEW", links: rels.map((rel) => ({ rel, href: "" })) });

  it("falls back to supporting info while PayPal reviews the case", () => {
    const steps = planActions(withLinks(["self", "provide_supporting_info"]), base, record);
    expect(steps).toHaveLength(1);
    expect(steps[0].action).toMatchObject({ kind: "provide_supporting_info" });
    expect((steps[0].action as { notes: string }).notes).toMatch(/^Tracking: USPS 940011120206\. Delivered and signed\./);
  });

  it("plans nothing when PayPal allows nothing", () => {
    expect(planActions(withLinks(["self"]), { ...base, recommended_action: "ACCEPT" }, record)).toEqual([]);
  });
});
