import { describe, expect, it } from "vitest";
import { breakEvenProbability, computeEconomics, isQuickCall } from "./economics";

const base = { disputeFee: 15, minutesToRespond: 6, hourlyRate: 40 };

describe("computeEconomics", () => {
  it("fights a well-evidenced high-value dispute", () => {
    const e = computeEconomics({ ...base, amount: 189, winProbability: 0.85 });
    expect(e.cheaperOption).toBe("FIGHT");
    expect(e.timeCost).toBe(4);
    expect(e.fightExpectedCost).toBe(34.6); // 0.15 * 204 + 4
    expect(e.expectedSavingsFromFighting).toBe(154.4);
  });

  it("accepts a cheap dispute even with decent odds", () => {
    const e = computeEconomics({ ...base, amount: 12, winProbability: 0.5 });
    expect(e.cheaperOption).toBe("ACCEPT");
  });

  it("clamps probabilities outside 0..1", () => {
    expect(computeEconomics({ ...base, amount: 50, winProbability: 3 }).fightExpectedCost).toBe(4);
    expect(computeEconomics({ ...base, amount: 50, winProbability: -1 }).fightExpectedCost).toBe(69);
  });
});

describe("breakEvenProbability", () => {
  it("is the point where both options cost the same", () => {
    const p = breakEvenProbability({ ...base, amount: 100 });
    const e = computeEconomics({ ...base, amount: 100, winProbability: p });
    expect(e.fightExpectedCost).toBeCloseTo(e.acceptCost, 5);
  });

  it("never asks for more than certainty", () => {
    expect(breakEvenProbability({ ...base, amount: 2 })).toBe(1);
  });
});

describe("isQuickCall", () => {
  it("flags tiny disputes where refunding wins even at 90% odds", () => {
    expect(isQuickCall({ ...base, amount: 6 })).toBe(true);
    expect(isQuickCall({ ...base, amount: 12 })).toBe(false);
  });
});
