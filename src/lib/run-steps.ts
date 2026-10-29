import { createHash } from "node:crypto";
import { PayPalError } from "@/lib/paypal/client";
import { describeRequest, type PlannedStep } from "@/lib/plan";
import type { AuditEntry } from "@/lib/records";
import type { Source } from "@/lib/source";

// Sends the steps in order, logging the exact request and PayPal's response for each.
// A failed log write is only logged: it must never turn a step PayPal accepted into a "rejected" one.
export async function runSteps(
  src: Pick<Source, "act">,
  disputeId: string,
  mode: AuditEntry["mode"],
  steps: PlannedStep[],
  idSeed: string,
  log: (e: AuditEntry) => Promise<unknown>,
): Promise<{ ok: boolean; message: string }> {
  const record = (e: AuditEntry) => log(e).catch((err) => console.error("audit entry not saved", disputeId, e.action, err));
  for (const step of steps) {
    // Same seed + same step = same request id, so a retried click is not applied twice.
    const requestId = createHash("sha256").update(`${disputeId}:${idSeed}:${step.action.kind}`).digest("hex").slice(0, 36);
    const request = describeRequest(disputeId, step.action);
    const base = { at: new Date().toISOString(), disputeId, mode, action: step.action.kind, detail: step.label, request };
    let response: unknown;
    try {
      response = await src.act(disputeId, step.action, requestId);
    } catch (e) {
      const message = e instanceof PayPalError ? `${e.message}${e.debugId ? ` (debug id ${e.debugId})` : ""}` : "Unexpected error";
      console.error("action failed", disputeId, step.action.kind, e);
      await record({ ...base, ok: false, error: message, response: e instanceof PayPalError ? e.details : undefined });
      return { ok: false, message: `PayPal rejected "${step.label}": ${message}` };
    }
    await record({ ...base, ok: true, response: response ?? { status: 204 } });
  }
  return { ok: true, message: `Done: ${steps.map((s) => s.label).join(" · ")}.` };
}
