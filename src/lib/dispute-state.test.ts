import { describe, expect, it } from "vitest";
import { outcomeOf } from "./dispute-state";

describe("outcomeOf", () => {
  it("says the seller kept the money when PayPal closed it without charging them", () => {
    for (const code of ["RESOLVED_SELLER_FAVOUR", "DENIED", "CANCELED_BY_BUYER", "RESOLVED_WITH_PAYOUT"]) {
      expect(outcomeOf(code).sellerKept).toBe(true);
    }
  });
  it("says the buyer won only for buyer outcomes, and stays neutral otherwise", () => {
    expect(outcomeOf("RESOLVED_BUYER_FAVOUR").sellerKept).toBe(false);
    expect(outcomeOf("ACCEPTED").sellerKept).toBe(false);
    expect(outcomeOf("NONE")).toEqual({ sellerKept: null, title: "Closed", pill: "closed" });
    expect(outcomeOf(undefined).sellerKept).toBeNull();
  });
});
