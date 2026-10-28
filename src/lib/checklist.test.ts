import { describe, expect, it } from "vitest";
import { evidenceChecklist } from "./checklist";
import type { FulfillmentRecord } from "./fulfillment";
import type { Dispute } from "./paypal/types";

const dispute = (reason: Dispute["reason"], value = "189.00", item = "Wool throw"): Dispute => ({
  dispute_id: "D",
  create_time: "",
  update_time: "",
  reason,
  status: "WAITING_FOR_SELLER_RESPONSE",
  dispute_amount: { currency_code: "USD", value },
  disputed_transactions: [{ items: [{ item_name: item }] }],
});

const record: FulfillmentRecord = {
  orderId: "O",
  captureId: "C",
  createdAt: "",
  buyerName: "",
  buyerEmail: "",
  shipTo: "Portland, OR, US",
  items: [],
  total: "189.00",
  carrier: "USPS",
  trackingNumber: "9400",
  deliveredAt: "2026-10-20T10:00:00Z",
};

const status = (items: { label: string; status: string }[], label: string) => items.find((i) => i.label === label)?.status;

describe("evidenceChecklist", () => {
  it("flags a missing signature on a high-value not-received claim", () => {
    const items = evidenceChecklist({ dispute: dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED"), trackers: [], record, history: null, signatureThreshold: 150 });
    expect(status(items, "Signature on delivery")).toBe("missing");
    expect(status(items, "Tracking on the PayPal transaction")).toBe("weak");
    expect(status(items, "Carrier shows delivered")).toBe("have");
  });

  it("treats signature as optional below the threshold", () => {
    const items = evidenceChecklist({ dispute: dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "40.00"), trackers: [], record, history: null, signatureThreshold: 150 });
    expect(status(items, "Signature on delivery")).toBe("weak");
  });

  it("needs a refund ID for refund-not-processed", () => {
    const items = evidenceChecklist({ dispute: dispute("CREDIT_NOT_PROCESSED"), trackers: [], record, history: null, signatureThreshold: 150 });
    expect(status(items, "Refund ID")).toBe("missing");
  });

  it("warns that digital goods lack Seller Protection", () => {
    const items = evidenceChecklist({ dispute: dispute("MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "20.00", "Digital pattern download"), trackers: [], record, history: null, signatureThreshold: 150 });
    expect(items.map((i) => i.label)).toContain("Seller Protection");
  });
});
