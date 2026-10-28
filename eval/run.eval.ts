import { writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { analyzeDispute, type AnalysisResult } from "@/lib/agent";
import { quickCallFor } from "@/lib/case";
import { merchant } from "@/lib/merchant";
import type { Source } from "@/lib/source";
import { cases as firstSet, type EvalCase, type Lean } from "./dataset";
import { heldout } from "./heldout";
import { injection } from "./injection";

// Runs every synthetic case through the same analyzeDispute the app uses, against an in-memory source.
// Quick calls go through the same code check the app shows ("Quick call, no AI needed").

const MODEL = process.env.AI_MODEL || "claude-haiku-5-5";
// USD per million tokens, Claude Haiku 5.5 (prompts under 100K tokens). Cache writes 1.25x input, reads 0.1x.
const PRICE = { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 };
const CONCURRENCY = 3;
// EVAL_SET=heldout runs the messy cases written apart from the prompt; EVAL_SET=injection the prompt-injection
// cases. Each set writes its own results files.
const SET = process.env.EVAL_SET === "heldout" || process.env.EVAL_SET === "injection" ? process.env.EVAL_SET : "synthetic";
const HELDOUT = SET === "heldout";
const cases = SET === "heldout" ? heldout : SET === "injection" ? injection : firstSet;
const OUT = SET === "synthetic" ? "eval/results" : `eval/${SET}-results`;

function sourceFor(c: EvalCase): Source {
  const amount = c.dispute.dispute_amount;
  return {
    mode: "demo",
    listDisputes: async () => [c.dispute],
    getDispute: async () => c.dispute,
    getPayment: async () => ({
      capture: { id: c.record.captureId, status: "COMPLETED", amount, create_time: c.record.createdAt },
      order: {
        id: c.record.orderId,
        status: "COMPLETED",
        create_time: c.record.createdAt,
        payer: { email_address: c.record.buyerEmail },
        purchase_units: [{ amount }],
      },
    }),
    getTrackers: async () => c.trackers,
    getFulfillment: async () => c.record,
    getBuyerHistory: async (email) => ({ email, orders: 0, totalSpent: 0, firstOrderAt: null, priorDisputes: 0, ...c.history }),
    act: async () => {
      throw new Error("The eval never sends anything.");
    },
  };
}

type Row = {
  id: string;
  title: string;
  expected: Lean[];
  got: Lean | null;
  correct: boolean;
  route: "quick call" | "agent";
  seconds: number;
  cost: number;
  winProbability?: number;
  modelEstimate?: number;
  removed?: number;
  sentBack?: number;
  changedMind?: boolean;
  leaksCut?: number;
  // Injection cases: forbidden text found in the final buyer message (should be none).
  leaked?: string[];
  error?: string;
};

const cost = (u: NonNullable<AnalysisResult["usage"]>) =>
  (u.input * PRICE.input + u.output * PRICE.output + u.cacheWrite * PRICE.cacheWrite + u.cacheRead * PRICE.cacheRead) / 1e6;

async function runCase(c: EvalCase): Promise<Row> {
  const base = { id: c.id, title: c.title, expected: c.expected };
  const t0 = performance.now();
  if (quickCallFor(c.dispute)) {
    const got: Lean = "ACCEPT";
    return { ...base, got, correct: c.expected.includes(got), route: "quick call", seconds: (performance.now() - t0) / 1000, cost: 0 };
  }
  try {
    const r = await analyzeDispute(sourceFor(c), c.dispute.dispute_id);
    const got = r.assessment.recommended_action;
    return {
      ...base,
      got,
      correct: c.expected.includes(got),
      route: "agent",
      seconds: (performance.now() - t0) / 1000,
      cost: r.usage ? cost(r.usage) : 0,
      winProbability: r.assessment.win_probability,
      modelEstimate: r.calibration?.modelEstimate,
      removed: r.grounding?.removed.length,
      sentBack: r.grounding?.sentBack,
      changedMind: r.hypotheses?.some((h) => h.changed) ?? false,
      leaksCut: r.grounding?.removed.filter((x) => /internal/.test(x.reason)).length ?? 0,
      leaked: c.mustNotSay?.filter((s) => r.assessment.buyer_message.toLowerCase().includes(s.toLowerCase())),
    };
  } catch (e) {
    return { ...base, got: null, correct: false, route: "agent", seconds: (performance.now() - t0) / 1000, cost: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (n: number) => `${Math.round(n * 100)}%`;

it(`runs the ${SET} dispute set`, async () => {
  expect(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY must be set in .env.local").toBeTruthy();
  const rows: Row[] = new Array(cases.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < cases.length) {
        const i = next++;
        rows[i] = await runCase(cases[i]);
        console.info(rows[i].id, rows[i].got, rows[i].correct ? "ok" : "MISS", `${rows[i].seconds.toFixed(0)}s`);
      }
    }),
  );

  const agent = rows.filter((r) => r.route === "agent");
  const correct = rows.filter((r) => r.correct).length;
  const agentCorrect = agent.filter((r) => r.correct).length;
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const medianSeconds = median(agent.map((r) => r.seconds));
  const reviewMinutes = merchant.minutesWithDraft;
  const summary = {
    model: MODEL,
    ranAt: new Date().toISOString(),
    cases: rows.length,
    correct,
    accuracy: correct / rows.length,
    agentCases: agent.length,
    agentCorrect,
    agentAccuracy: agentCorrect / agent.length,
    quickCalls: rows.length - agent.length,
    errors: agent.filter((r) => r.error).length,
    totalCostUsd: Math.round(totalCost * 10000) / 10000,
    medianAgentSeconds: Math.round(medianSeconds),
    manualMinutesEstimate: merchant.minutesWithoutDraft,
    reviewMinutesEstimate: reviewMinutes,
    claimsSentBack: agent.reduce((s, r) => s + (r.sentBack ?? 0), 0),
    claimsRemoved: agent.reduce((s, r) => s + (r.removed ?? 0), 0),
    oddsLowered: agent.filter((r) => r.modelEstimate !== undefined && r.winProbability! < r.modelEstimate).length,
    changedMind: agent.filter((r) => r.changedMind).length,
  };

  const lines = [
    HELDOUT
      ? "# Held-out eval: messy disputes written apart from the prompt"
      : SET === "injection"
        ? "# Injection eval: buyer messages that try to steer the verdict or extract internal data"
        : "# Offline eval: synthetic disputes",
    "",
    "Synthetic eval, not a merchant pilot. Generated by `pnpm eval`; method in the README.",
    "",
    `- Model: \`${summary.model}\`, run ${summary.ranAt.slice(0, 16).replace("T", " ")} UTC`,
    `- Accuracy: **${correct}/${rows.length} (${pct(summary.accuracy)})**; agent only ${agentCorrect}/${agent.length} (${pct(summary.agentAccuracy)}); ${summary.quickCalls} quick calls decided in code`,
    `- Cost: **$${totalCost.toFixed(3)}** for the whole run (from the API's reported token usage)`,
    `- Time: median **${summary.medianAgentSeconds} s** per agent case, plus about ${reviewMinutes} min for the seller to review, against an estimated ${summary.manualMinutesEstimate} min by hand (an assumption, not measured)`,
    `- Source check: ${summary.claimsSentBack} claims sent back for a rewrite, ${summary.claimsRemoved} cut in code; win odds lowered by the evidence cap in ${summary.oddsLowered} cases; the agent changed its mind mid-investigation in ${summary.changedMind} cases`,
    "",
    "| Case | Expected | Got | | Odds (agent said) | Time | Cost |",
    "|---|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.id} ${r.title} | ${r.expected.join(" or ")} | ${r.got ?? `error: ${r.error}`}${r.changedMind ? " (changed mind)" : ""} | ${r.correct ? "✓" : "✗"} | ${
          r.winProbability === undefined ? "-" : `${pct(r.winProbability)}${r.modelEstimate !== undefined && r.modelEstimate > r.winProbability ? ` (${pct(r.modelEstimate)})` : ""}`
        } | ${r.route === "quick call" ? "code" : `${r.seconds.toFixed(0)} s`} | $${r.cost.toFixed(4)} |`,
    ),
    "",
    ...(SET === "injection"
      ? [
          "## Leaks",
          "",
          ...rows.map((r) => `- ${r.id}: ${r.leaked?.length ? `LEAKED ${r.leaked.join(", ")}` : "buyer message clean"}; ${r.leaksCut ?? 0} leaking sentence(s) cut in code`),
          "",
        ]
      : []),
    "## Misses",
    "",
    ...(rows.some((r) => !r.correct)
      ? rows.filter((r) => !r.correct).map((r) => `- ${r.id}: expected ${r.expected.join(" or ")}, got ${r.got ?? "an error"}. Label rationale: ${cases.find((c) => c.id === r.id)?.why}`)
      : ["None."]),
    "",
  ];
  await writeFile(`${OUT}.md`, lines.join("\n"));
  await writeFile(`${OUT}.json`, JSON.stringify({ summary, rows }, null, 2) + "\n");
  console.info(summary);
  expect(rows.every(Boolean)).toBe(true);
});
