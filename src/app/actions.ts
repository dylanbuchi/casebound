"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { checkPasscode, isUnlocked, newCookie, PASS_COOKIE } from "@/lib/auth";
import { COOKIE_TTL_MS } from "@/lib/pass";
import { clientIp, rateLimiter } from "@/lib/limits";
import { QUICK_ACCEPT_MESSAGE, quickCallFor } from "@/lib/case";
import { PayPalError } from "@/lib/paypal/client";
import { allowedActions } from "@/lib/dispute-state";
import { describeRequest, isStale, offerProblem, planActions, STALE_MESSAGE, withEdits, type PlannedStep } from "@/lib/plan";
import { appendAudit, deleteAnalysis, getAnalysis, type AuditEntry } from "@/lib/records";
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
  evidenceNotes: z.string().max(2000),
  buyerMessage: z.string().max(2000),
});


// Sends the steps in order, logging the exact request and PayPal's response for each.
async function runSteps(src: Source, disputeId: string, steps: PlannedStep[], idSeed: string): Promise<ActionState> {
  for (const step of steps) {
    // Same seed + same step = same request id, so a retried click is not applied twice.
    const requestId = createHash("sha256").update(`${disputeId}:${idSeed}:${step.action.kind}`).digest("hex").slice(0, 36);
    const request = describeRequest(disputeId, step.action);
    const base = { at: new Date().toISOString(), disputeId, mode: modeOf(disputeId), action: step.action.kind, detail: step.label, request };
    try {
      const response = await src.act(disputeId, step.action, requestId);
      await appendAudit({ ...base, ok: true, response: response ?? { status: 204 } });
    } catch (e) {
      const message = e instanceof PayPalError ? `${e.message}${e.debugId ? ` (debug id ${e.debugId})` : ""}` : "Unexpected error";
      console.error("action failed", disputeId, step.action.kind, e);
      await appendAudit({ ...base, ok: false, error: message, response: e instanceof PayPalError ? e.details : undefined });
      revalidatePath(`/disputes/${disputeId}`);
      return { ok: false, message: `PayPal rejected "${step.label}": ${message}` };
    }
  }
  revalidatePath("/");
  revalidatePath("/log");
  revalidatePath(`/disputes/${disputeId}`);
  return { ok: true, message: `Done: ${steps.map((s) => s.label).join(" · ")}.` };
}

// Runs the approved plan. The client sends only edited wording; the structure
// (which call, which amount, which tracking number) is rebuilt on the server.
export async function executePlan(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await isUnlocked())) return { ok: false, message: "Enter the passcode first." };
  const parsed = ExecuteInput.safeParse({
    disputeId: form.get("disputeId"),
    evidenceNotes: form.get("evidenceNotes") ?? "",
    buyerMessage: form.get("buyerMessage") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { disputeId, ...edits } = parsed.data;

  const src = source();
  const analysis = await getAnalysis(disputeId);
  if (!analysis) return { ok: false, message: "Run the analysis first." };

  const dispute = await src.getDispute(disputeId);
  if (isStale(analysis.disputeUpdatedAt, dispute)) return { ok: false, message: STALE_MESSAGE };
  const fulfillment = await src.getFulfillment(dispute);
  const steps = planActions(dispute, analysis.assessment, fulfillment).map((s) => ({ ...s, action: withEdits(s.action, edits) }));
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
