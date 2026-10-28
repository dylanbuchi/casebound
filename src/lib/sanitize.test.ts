import { describe, expect, it } from "vitest";
import { stripMarkup } from "./sanitize";

describe("stripMarkup", () => {
  it("cuts leaked tool-call markup from strings", () => {
    const leaked = 'Switch to ACCEPT if out of stock.</action_reasoning>\n<parameter name="offer_amount">0';
    expect(stripMarkup({ a: leaked, b: ["ok", leaked], n: 3 })).toEqual({
      a: "Switch to ACCEPT if out of stock.",
      b: ["ok", "Switch to ACCEPT if out of stock."],
      n: 3,
    });
  });

  it("leaves ordinary text with angle brackets alone", () => {
    expect(stripMarkup("Costs < $20 and > $5")).toBe("Costs < $20 and > $5");
  });
});
