// Deterministic money math. The model estimates a win probability with reasons;
// code, not the model, turns that into an expected cost so the numbers are auditable.

export type EconomicsInput = {
  amount: number; // disputed amount
  disputeFee: number; // fee charged if the seller loses (merchant-configured)
  winProbability: number; // 0..1, from the agent's assessment
  minutesToRespond: number; // seller time to fight with the drafted response
  hourlyRate: number; // value of the seller's time
};

export type Economics = {
  acceptCost: number;
  fightExpectedCost: number;
  timeCost: number;
  expectedSavingsFromFighting: number;
  cheaperOption: "FIGHT" | "ACCEPT";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeEconomics(i: EconomicsInput): Economics {
  const p = Math.min(1, Math.max(0, i.winProbability));
  const timeCost = (Math.max(0, i.minutesToRespond) / 60) * Math.max(0, i.hourlyRate);
  const acceptCost = i.amount;
  const fightExpectedCost = (1 - p) * (i.amount + i.disputeFee) + timeCost;
  const savings = acceptCost - fightExpectedCost;
  return {
    acceptCost: round2(acceptCost),
    fightExpectedCost: round2(fightExpectedCost),
    timeCost: round2(timeCost),
    expectedSavingsFromFighting: round2(savings),
    cheaperOption: savings > 0 ? "FIGHT" : "ACCEPT",
  };
}

// Smallest win probability at which fighting beats refunding.
export function breakEvenProbability(i: Omit<EconomicsInput, "winProbability">): number {
  const timeCost = (i.minutesToRespond / 60) * i.hourlyRate;
  const atRisk = i.amount + i.disputeFee;
  if (atRisk <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - (i.amount - timeCost) / atRisk));
}

// Refunding is cheaper unless the seller is near-certain to win: no need to spend an AI run.
export const QUICK_CALL_THRESHOLD = 0.9;
export function isQuickCall(i: Omit<EconomicsInput, "winProbability">): boolean {
  return breakEvenProbability(i) >= QUICK_CALL_THRESHOLD;
}
