"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { executePlan, type ActionState } from "@/app/actions";
import { describeRequest, withEdits, type PlannedStep } from "@/lib/plan";

export function ApprovePanel(props: {
  disputeId: string;
  actionable: boolean;
  sent?: boolean;
  warning?: string;
  unlocked: boolean;
  steps: PlannedStep[];
  evidenceNotes: string;
  buyerMessage: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(executePlan, null);
  const [evidenceNotes, setEvidenceNotes] = useState(props.evidenceNotes);
  const [buyerMessage, setBuyerMessage] = useState(props.buyerMessage);
  const showEvidence = props.steps.some((s) => s.action.kind === "provide_evidence" || s.action.kind === "provide_supporting_info");
  const showMessage = props.steps.some((s) => s.action.kind !== "provide_evidence" && s.action.kind !== "provide_supporting_info");
  // Same edit logic the server applies, so the preview is exactly what gets sent.
  const previews = props.steps.map((s) => ({
    label: s.label,
    request: describeRequest(props.disputeId, withEdits(s.action, { evidenceNotes, buyerMessage })),
  }));

  return (
    <form action={action} className="rise rounded-lg border-2 border-ink bg-card p-5" aria-label="Review and send">
      <h2 className="font-display text-2xl font-semibold">Review and send</h2>
      <p className="mb-4 text-sm text-ink-2">Nothing goes out before you click.</p>
      <input type="hidden" name="disputeId" value={props.disputeId} />

      {props.warning && (
        <p className="mb-4 rounded-md border border-fight bg-paper p-3 text-sm font-medium text-fight">{props.warning}</p>
      )}
      {props.steps.length === 0 ? (
        <p className="mb-4 rounded-md border border-rule bg-paper p-3 text-sm text-ink-2">
          PayPal is not accepting this kind of response on the dispute right now.
        </p>
      ) : (
        <ol className="mb-4 space-y-1.5" aria-label="What will happen">
          {props.steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink font-mono text-[11px] text-paper">{i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      )}

      {/* What goes out, at a glance; the full wording and the raw request stay one click away. */}
      <div className="space-y-3">
        {showEvidence && <Draft label="To PayPal" text={evidenceNotes} />}
        {showMessage && <Draft label="To the buyer" text={buyerMessage} />}
      </div>

      <details className="mt-4 rounded-md border border-rule bg-paper">
        <summary className="px-3 py-2.5 text-sm font-medium">Edit the wording</summary>
        <div className="space-y-4 px-3 pb-3">
          {showEvidence ? (
            <label className="block">
              <span className="text-sm font-medium">Response to PayPal</span>
              <textarea
                name="evidenceNotes"
                value={evidenceNotes}
                onChange={(e) => setEvidenceNotes(e.target.value)}
                maxLength={2000}
                rows={7}
                className="field mt-1.5 text-sm"
              />
            </label>
          ) : (
            <input type="hidden" name="evidenceNotes" value={evidenceNotes} />
          )}
          {showMessage ? (
            <label className="block">
              <span className="text-sm font-medium">Message to the buyer</span>
              <textarea
                name="buyerMessage"
                value={buyerMessage}
                onChange={(e) => setBuyerMessage(e.target.value)}
                maxLength={2000}
                rows={4}
                className="field mt-1.5 text-sm"
              />
            </label>
          ) : (
            <input type="hidden" name="buyerMessage" value={buyerMessage} />
          )}
        </div>
      </details>

      <details className="mt-2 rounded-md border border-rule bg-paper">
        <summary className="px-3 py-2.5 text-sm font-medium text-ink-2">
          Technical details: the exact PayPal request{previews.length > 1 ? "s" : ""} ({previews.length})
        </summary>
        <div className="space-y-3 px-3 pb-3">
          {previews.map((p) => (
            <div key={p.label}>
              <p className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="rounded bg-ink px-1.5 py-0.5 font-bold text-paper">{p.request.method}</span>
                <span className="break-all">{p.request.path}</span>
                <span className="text-ink-3">{p.request.contentType}</span>
              </p>
              <pre className="mt-1.5 max-h-64 overflow-auto rounded bg-ink p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-words text-paper">
                {JSON.stringify(p.request.body, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!props.unlocked ? (
          <Link href="/unlock" className="btn btn-line">
            Unlock to send
          </Link>
        ) : props.sent || state?.ok ? (
          <span role="status" className="flex items-center gap-3">
            <span className="stamp stamp-in text-base text-accept">Sent</span>
            <span className="text-sm font-medium text-accept">PayPal has it. The receipt is below.</span>
          </span>
        ) : (
          <button
            type="submit"
            disabled={pending || !props.actionable || props.steps.length === 0}
            className="btn btn-ink px-6 py-3 text-base"
          >
            {pending && <span className="spinner" aria-hidden />}
            {pending ? "Sending to PayPal…" : props.actionable ? "Approve and send" : "Already handled"}
          </button>
        )}
        <span className="text-xs text-ink-3">Sent through the PayPal Disputes API. Every call is kept as a receipt.</span>
      </div>

      {state &&
        (state.ok ? (
          <p className="rise mt-3 text-sm text-ink-2">{state.message}</p>
        ) : (
          <p role="alert" className="rise mt-4 rounded-md border border-fight/50 bg-paper px-3 py-2 text-sm text-fight">
            {state.message}
          </p>
        ))}
    </form>
  );
}

function Draft({ label, text }: { label: string; text: string }) {
  return (
    <figure className="border-l-2 border-rule pl-3">
      <figcaption className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">{label}</figcaption>
      <blockquote className="mt-0.5 line-clamp-3 text-sm leading-relaxed text-ink-2">{text || "(empty)"}</blockquote>
    </figure>
  );
}
