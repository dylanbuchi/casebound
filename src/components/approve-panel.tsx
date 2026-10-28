"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { executePlan, type ActionState } from "@/app/actions";
import { describeRequest, withEdits, type PlannedStep } from "@/lib/plan";

export function ApprovePanel(props: {
  disputeId: string;
  actionable: boolean;
  unlocked: boolean;
  steps: PlannedStep[];
  evidenceNotes: string;
  buyerMessage: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(executePlan, null);
  const [evidenceNotes, setEvidenceNotes] = useState(props.evidenceNotes);
  const [buyerMessage, setBuyerMessage] = useState(props.buyerMessage);
  const showEvidence = props.steps.some((s) => s.action.kind === "provide_evidence");
  // Same edit logic the server applies, so the preview is exactly what gets sent.
  const previews = props.steps.map((s) => ({
    label: s.label,
    request: describeRequest(props.disputeId, withEdits(s.action, { evidenceNotes, buyerMessage })),
  }));

  return (
    <form action={action} className="rise rounded-lg border-2 border-ink bg-card p-5">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Review and send</h2>
      <input type="hidden" name="disputeId" value={props.disputeId} />

      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm font-medium">
        {props.steps.map((s) => (
          <li key={s.label}>{s.label}</li>
        ))}
      </ol>

      {showEvidence ? (
        <label className="block">
          <span className="text-sm font-medium">Response to PayPal</span>
          <textarea
            name="evidenceNotes"
            value={evidenceNotes}
            onChange={(e) => setEvidenceNotes(e.target.value)}
            maxLength={2000}
            rows={7}
            className="mt-1 w-full rounded border border-rule bg-paper p-3 text-sm leading-relaxed"
          />
        </label>
      ) : (
        <input type="hidden" name="evidenceNotes" value={evidenceNotes} />
      )}

      <label className="mt-3 block">
        <span className="text-sm font-medium">Message to the buyer</span>
        <textarea
          name="buyerMessage"
          value={buyerMessage}
          onChange={(e) => setBuyerMessage(e.target.value)}
          maxLength={2000}
          rows={4}
          className="mt-1 w-full rounded border border-rule bg-paper p-3 text-sm leading-relaxed"
        />
      </label>

      <details className="mt-4 rounded border border-rule bg-paper">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
          Exact PayPal request{previews.length > 1 ? "s" : ""} ({previews.length})
        </summary>
        <div className="space-y-3 px-3 pb-3">
          {previews.map((p) => (
            <div key={p.label}>
              <p className="font-mono text-xs">
                <span className="font-bold">{p.request.method}</span> {p.request.path}{" "}
                <span className="text-ink-3">· {p.request.contentType}</span>
              </p>
              <pre className="mt-1 max-h-56 overflow-auto rounded bg-card p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap break-words">
                {JSON.stringify(p.request.body, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!props.unlocked ? (
          <Link href="/unlock" className="text-sm underline">
            Unlock to send
          </Link>
        ) : (
          <button
            type="submit"
            disabled={pending || !props.actionable || state?.ok === true}
            className="rounded-md bg-ink px-5 py-2.5 font-medium text-paper transition hover:bg-ink-2 disabled:opacity-50"
          >
            {pending ? "Sending to PayPal…" : props.actionable ? "Approve and send" : "Already handled"}
          </button>
        )}
        <span className="text-xs text-ink-3">Nothing is sent until you click. Every call is logged with PayPal&apos;s reply.</span>
      </div>

      {state && (
        <p role="status" className={`mt-3 text-sm ${state.ok ? "text-accept" : "text-fight"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
