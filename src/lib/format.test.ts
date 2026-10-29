import { describe, expect, it } from "vitest";
import { fightSavings, statusLabel } from "./format";

describe("fightSavings", () => {
  it("is good only when fighting is the pick", () => {
    expect(fightSavings(154.4, "FIGHT")).toEqual({ text: "+$154.40", good: true });
    expect(fightSavings(1.4, "ACCEPT")).toEqual({ text: "+$1.40", good: false });
    expect(fightSavings(-12, "FIGHT")).toEqual({ text: "-$12.00", good: false });
  });

  it("shows a dash when there is no analysis", () => {
    expect(fightSavings(null, null)).toEqual({ text: "-", good: false });
  });
});

describe("statusLabel", () => {
  it("uses the short label for a dispute waiting on the seller", () => {
    expect(statusLabel("WAITING_FOR_SELLER_RESPONSE")).toBe("Needs reply");
  });
});
