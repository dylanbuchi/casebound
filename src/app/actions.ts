"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { checkPasscode, isUnlocked, newCookie, PASS_COOKIE } from "@/lib/auth";
import { COOKIE_TTL_MS } from "@/lib/pass";
import { clientIp, rateLimiter } from "@/lib/limits";
import { QUICK_ACCEPT_MESSAGE, quickCallFor } from "@/lib/case";
import { allowedActions } from "@/lib/dispute-state";
import { applyEdits, isStale, offerProblem, planActions, STALE_MESSAGE, type PlannedStep } from "@/lib/plan";
import { appendAudit, deleteAnalysis, getAnalysis, type AuditEntry } from "@/lib/records";
import { runSteps as sendSteps } from "@/lib/run-steps";
import { updateJson } from "@/lib/store";
import { isPractice, modeOf, source, type Source } from "@/lib/source";

export type ActionState = { ok: boolean; message: string } | null;

// Five tries per network per 15 minutes, and each wrong one waits a second, to slow guessing down.
const unlockTries = rateLimiter(5, 15 * 60 * 1000);
// Backstop across all networks in case the per-network key is ever wrong: 50 tries per 15 minutes in total.
const allUnlockTries = rateLimiter(50, 15 * 60 * 1000);

export async function unlock(_prev: ActionState, form: FormData): Promise<ActionState> {
  const tries = unlockTries.take(clientIp(await headers()));
  const all = tries.ok ? allUnlockTries.take("all") : tries;
  if (!all.ok) return { ok: false, message: `Too many tries. Wait ${Math.ceil(all.retryMs / 60000)} min and try again.` };
  const code = String(form.get("passcode") ?? "").slice(0, 200);
  if (!checkPasscode(code)) {
    await new Promise((r) => setTimeout(r, 1000));
    return { ok: false, message: "That passcode is not right." };
  }
  (await cookies()).set(PASS_COOKIE, newCookie(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_TTL_MS / 1000,
    path: "/",
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Unlocked." };
}

const DisputeId = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

const ExecuteInput = z.object({
  disputeId: DisputeId,
  analysisAt: z.string().max(64),
  evidenceNotes: z.string().max(2000),
  buyerMessage: z.string().max(2000),
});


// Runs the steps, then refreshes every page that shows this dispute or the log.
async function runSteps(src: Source, disputeId: string, steps: PlannedStep[], idSeed: string): Promise<ActionState> {
  const result = await sendSteps(src, disputeId, modeOf(disputeId), steps, idSeed, appendAudit);
  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath(`/disputes/${disputeId}`);
  return result;
}

// Runs the approved plan. The client sends only edited wording; the structure
// (which call, which amount, which tracking number) is rebuilt on the server.
export async function executePlan(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isUnlocked())) return { ok: false, message: "Enter the passcode first." };
  const parsed = ExecuteInput.safeParse({
    disputeId: form.get("disputeId"),
    analysisAt: form.get("analysisAt") ?? "",
    evidenceNotes: form.get("evidenceNotes") ?? "",
    buyerMessage: form.get("buyerMessage") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { disputeId, analysisAt, ...edits } = parsed.data;

  const src = source();
  const analysis = await getAnalysis(disputeId);
  if (!analysis) return { ok: false, message: "Run the analysis first." };
  // Edited wording from an older draft must not go out with a newer plan (e.g. "fight" text with an "accept").
  if (analysisAt !== analysis.createdAt) return { ok: false, message: "The analysis changed since this page loaded. Reload and review the new draft." };

  const dispute = await src.getDispute(disputeId);
  if (isStale(analysis.disputeUpdatedAt, dispute)) return { ok: false, message: STALE_MESSAGE };
  const fulfillment = await src.getFulfillment(dispute);
  const planned = planActions(dispute, analysis.assessment, fulfillment);
  const { steps, problem: editProblem } = applyEdits(planned, edits);
  if (editProblem) return { ok: false, message: editProblem };
  if (planned.length > 0 && steps.length === 0) return { ok: false, message: "Write a message to the buyer first." };
  if (steps.length === 0) {
    const problem = offerProblem(dispute, analysis.assessment);
    if (problem) return { ok: false, message: problem };
    return { ok: false, message: `PayPal is not accepting this response right now (status: ${dispute.status.toLowerCase().replaceAll("_", " ")}).` };
  }
  return runSteps(src, disputeId, steps, analysis.createdAt);
}

// Accepts a tiny dispute without an AI run. Allowed only when refunding is
// cheaper even at 90% win odds, checked again here on the server.
export async function quickAccept(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isUnlocked())) return { ok: false, message: "Enter the passcode first." };
  const parsed = DisputeId.safeParse(form.get("disputeId"));
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const src = source();
  const dispute = await src.getDispute(parsed.data);
  if (!allowedActions(dispute).has("accept_claim")) return { ok: false, message: "PayPal is not accepting a claim acceptance on this dispute right now." };
  if (!quickCallFor(dispute)) return { ok: false, message: "This one is worth a proper look. Run the investigation instead." };

  const step: PlannedStep = {
    label: `Accept the claim and refund ${dispute.dispute_amount.value} ${dispute.dispute_amount.currency_code}`,
    action: { kind: "accept_claim", note: QUICK_ACCEPT_MESSAGE },
  };
  return runSteps(src, dispute.dispute_id, [step], `quick:${dispute.update_time}`);
}

// Puts the practice cases back to pending: clears their simulated sends, keeps the saved analyses.
export async function resetPractice(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isUnlocked())) return { ok: false, message: "Enter the passcode first." };
  const id = String(form.get("disputeId") ?? "");
  if (!isPractice(id)) return { ok: false, message: "Only practice cases can be reset." };
  await updateJson<Record<string, unknown>>("demo-state", {}, (all) => {
    const next = { ...all };
    delete next[id];
    return next;
  });
  await updateJson<AuditEntry[]>("audit", [], (all) => all.filter((e) => e.disputeId !== id));
  // Back to unanalyzed, so the next visitor can watch the investigation from the start.
  await deleteAnalysis(id);
  revalidatePath("/");
  revalidatePath(`/disputes/${id}`);
  return { ok: true, message: "Practice case reset." };
}
