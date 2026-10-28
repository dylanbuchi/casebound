import "server-only";
import type { AnalysisResult } from "@/lib/agent";
import { readJson, updateJson } from "@/lib/store";

export const getAnalyses = () => readJson<Record<string, AnalysisResult>>("analyses", {});

export async function getAnalysis(disputeId: string) {
  return (await getAnalyses())[disputeId] ?? null;
}

export const saveAnalysis = (a: AnalysisResult) =>
  updateJson<Record<string, AnalysisResult>>("analyses", {}, (all) => ({ ...all, [a.disputeId]: a }));

export type AuditEntry = {
  at: string;
  disputeId: string;
  mode: "demo" | "live";
  action: string;
  detail: string;
  ok: boolean;
  error?: string;
  request?: unknown;
  response?: unknown;
};

export const getAudit = () => readJson<AuditEntry[]>("audit", []);

export const appendAudit = (e: AuditEntry) => updateJson<AuditEntry[]>("audit", [], (all) => [e, ...all].slice(0, 500));

// Caps paid model runs per UTC day so a public demo cannot run up the bill.
export const dailyCap = () => Math.max(0, Number(process.env.AI_DAILY_CAP ?? 25) || 0);

export async function claimAnalysisSlot(): Promise<{ ok: boolean; used: number; cap: number }> {
  const cap = dailyCap();
  const today = new Date().toISOString().slice(0, 10);
  let ok = false;
  const counts = await updateJson<Record<string, number>>("ai-usage", {}, (all) => {
    const used = all[today] ?? 0;
    ok = used < cap;
    return ok ? { [today]: used + 1 } : { [today]: used };
  });
  return { ok, used: counts[today] ?? 0, cap };
}
