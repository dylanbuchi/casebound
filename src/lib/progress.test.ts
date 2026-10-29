import { describe, expect, it } from "vitest";
import { toolLabel } from "./progress";

describe("toolLabel", () => {
  it("names the first call plainly", () => {
    expect(toolLabel("estimate_economics")).toBe("Running the money math");
  });

  it("labels the second pass after a rewrite so it never reads as a duplicate", () => {
    expect(toolLabel("estimate_economics", { repeat: true, afterRewrite: true })).toBe("Re-running the money math after the rewrite");
    expect(toolLabel("record_assessment", { repeat: true, afterRewrite: true })).toBe("Writing the recommendation again with the fixes");
    expect(toolLabel("record_assessment", { repeat: true })).not.toBe(toolLabel("record_assessment"));
  });

  it("marks any other repeated lookup", () => {
    expect(toolLabel("get_dispute", { repeat: true })).toBe("Reading the dispute on PayPal again");
    expect(toolLabel("unknown_tool")).toBe("unknown_tool");
  });
});
