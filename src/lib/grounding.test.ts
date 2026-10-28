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

  it("never raises a low estimate and ignores dispute-side items", () => {
    expect(calibrate(0.2, [check("missing", "Dispute"), check("have", "PayPal")]).calibrated).toBe(0.2);
  });
});
