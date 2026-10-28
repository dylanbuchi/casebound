import { describe, expect, it } from "vitest";
import type { Assessment } from "./agent";
import type { CheckItem } from "./checklist";
import type { FulfillmentRecord } from "./fulfillment";
import { calibrate, enforceGrounding, findUnsupported, problemWith, type Facts } from "./grounding";

const record: FulfillmentRecord = {
  orderId: "DEMO-ORDER-7",
  captureId: "DEMO-CAP-7",
  createdAt: "",
  buyerName: "",
  buyerEmail: "",
  shipTo: "Austin, TX, US",
  items: [],
  total: "210.00",
  carrier: "UPS",
  trackingNumber: "1Z999AA10123456786",
  deliveredAt: "2026-10-20T10:00:00Z",
  signedBy: "R DIAZ",
};

// Shop says delivered and signed; PayPal's tracker only shows the parcel in transit.
const shopOnly: Facts = { record, trackers: [{ tracking_number: "1Z999AA10123456786", status: "IN_TRANSIT" }] };
const confirmed: Facts = { record, trackers: [{ tracking_number: "1Z999AA10123456786", status: "DELIVERED" }] };

describe("problemWith", () => {
  it("rejects a carrier delivery claim the carrier has not made", () => {
    expect(problemWith("UPS tracking confirms the parcel was delivered on Oct 20.", shopOnly)).toMatch(/IN_TRANSIT/);
    expect(problemWith("UPS tracking confirms the parcel was delivered on Oct 20.", confirmed)).toBeNull();
  });

  it("accepts the same fact when it names the shop record", () => {
    expect(problemWith("Our shop record shows it was delivered on Oct 20.", shopOnly)).toBeNull();
  });

  it("never lets a signature be credited to the carrier", () => {
    expect(problemWith("USPS tracking shows it was signed for by R DIAZ.", confirmed)).toMatch(/shop record/);
    expect(problemWith("Our records show it was signed for by R DIAZ.", confirmed)).toBeNull();
    expect(problemWith("It was signed for on delivery.", { ...confirmed, record: { ...record, signedBy: undefined } })).toMatch(/No signature/);
  });

  it("rejects reference numbers that are not on file", () => {
    expect(problemWith("Tracking 1Z999AA10123456786 shows delivered.", confirmed)).toBeNull();
    expect(problemWith("Tracking 1Z999AA99999999999 shows delivered.", confirmed)).toMatch(/not in PayPal/);
    expect(problemWith("USPS 9400 1112 0206 1234 5678 90 was used.", confirmed)).toMatch(/not in PayPal/);
  });

  it("rejects a delivery claim when nothing on file shows a delivery", () => {
    const nothing: Facts = { record: { ...record, deliveredAt: undefined }, trackers: [] };
    expect(problemWith("The parcel was delivered on Oct 20.", nothing)).toMatch(/No delivery is on file/);
    expect(problemWith("UPS confirmed delivery.", { ...nothing, trackers: [{ tracking_number: "1Z999AA10123456786" }] })).toMatch(
      /no delivery scan/,
    );
  });

  it("accepts refund IDs and extra IDs on file as known reference numbers", () => {
    const withRefund: Facts = { ...confirmed, record: { ...record, refunds: [{ refundId: "RF8812345678", amount: "20.00", at: "2026-10-18T10:00:00Z" }] } };
    expect(problemWith("We issued refund RF8812345678 already.", withRefund)).toBeNull();
    expect(problemWith("Dispute PP-D-123456789012 is open.", { ...confirmed, ids: ["PP-D-123456789012"] })).toBeNull();
    expect(problemWith("Refund RF9999999999 was issued.", withRefund)).toMatch(/not in PayPal/);
  });

  it("leaves hedged or negated sentences alone", () => {
    expect(problemWith("The carrier has not confirmed delivery yet.", shopOnly)).toBeNull();
    expect(problemWith("Please verify the signature with UPS before sending.", shopOnly)).toBeNull();
    expect(problemWith("The buyer claims it was never delivered.", shopOnly)).toBeNull();
  });
});

const assessment = (over: Partial<Assessment> = {}): Assessment => ({
  summary: "The parcel shows delivered. Fight it.",
  buyer_claim: "",
  key_facts: [
    { fact: "Delivered and signed by R DIAZ.", source: "paypal_tracking", supports: "SELLER" },
    { fact: "Signed by R DIAZ.", source: "shop_records", supports: "SELLER" },
  ],
  missing_evidence: [],
  win_probability: 0.85,
  win_probability_reasoning: "",
  recommended_action: "FIGHT",
  action_reasoning: "",
  offer_amount: null,
  offer_type: null,
  evidence_type: "PROOF_OF_FULFILLMENT",
  evidence_notes: "UPS tracking confirms delivery on Oct 20. Our shop record shows it was signed by R DIAZ.",
  buyer_message: "Hi, UPS shows the parcel was delivered.",
  risk_flags: [],
  ...over,
});

describe("enforceGrounding", () => {
  it("removes only the unsupported sentences and facts, and reports them", () => {
    const { assessment: a, removed } = enforceGrounding(assessment(), shopOnly);
    expect(a.evidence_notes).toBe("Our shop record shows it was signed by R DIAZ.");
    expect(a.buyer_message).toBe("");
    expect(a.key_facts.map((f) => f.source)).toEqual(["shop_records"]);
    expect(removed.map((r) => r.where)).toEqual(["evidence_notes", "buyer_message", "key_facts[0]"]);
  });

  it("returns the assessment unchanged when everything is backed", () => {
    const clean = assessment({
      summary: "Our shop record shows it was signed for by R DIAZ.",
      key_facts: [{ fact: "Signed by R DIAZ.", source: "shop_records", supports: "SELLER" }],
      evidence_notes: "UPS tracking 1Z999AA10123456786 shows delivered.",
      buyer_message: "Hi Rosa, our records show the parcel was delivered.",
    });
    const out = enforceGrounding(clean, confirmed);
    expect(out.removed).toEqual([]);
    expect(out.assessment).toBe(clean);
  });

  it("checks key facts by their stated source", () => {
    const a = assessment({ key_facts: [{ fact: "Delivered on Oct 20.", source: "paypal_tracking", supports: "SELLER" }] });
    expect(findUnsupported(a, shopOnly).find((r) => r.where === "key_facts[0]")?.reason).toMatch(/carrier has not confirmed/);
    expect(findUnsupported(a, confirmed).some((r) => r.where === "key_facts[0]")).toBe(false);
  });

  it("passes a fully confirmed case through untouched, except signature credited to tracking", () => {
    expect(findUnsupported(assessment(), confirmed).map((r) => r.where)).toEqual(["key_facts[0]"]);
  });
});

const check = (status: CheckItem["status"], source: CheckItem["source"], conflict = false): CheckItem => ({
  label: `${status} ${source}`,
  status,
  detail: "",
  source,
  ...(conflict ? { conflict } : {}),
});

describe("calibrate", () => {
  it("keeps a high estimate when PayPal confirms the key evidence", () => {
    const c = calibrate(0.85, [check("have", "PayPal"), check("have", "PayPal"), check("have", "Shop record")]);
    expect(c.calibrated).toBe(0.85);
  });

  it("lowers an estimate that rests on unverified or contradicted shop records", () => {
    const c = calibrate(0.85, [check("have", "PayPal"), check("weak", "Shop record", true), check("weak", "Shop record")]);
    expect(c.cap).toBe(0.6);
    expect(c.calibrated).toBe(0.6);
    expect(c.modelEstimate).toBe(0.85);
  });

  it("never goes below the floor, however much is missing", () => {
    const c = calibrate(0.7, Array.from({ length: 8 }, () => check("missing", "Shop record")));
    expect(c.cap).toBe(0.05);
    expect(c.calibrated).toBe(0.05);
    expect(c.basis.every((b) => b.why === "missing")).toBe(true);
  });

  it("never raises a low estimate and ignores dispute-side items", () => {
    expect(calibrate(0.2, [check("missing", "Dispute"), check("have", "PayPal")]).calibrated).toBe(0.2);
  });
});
