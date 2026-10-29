"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { executePlan, type ActionState } from "@/app/actions";
import { applyEdits, confirmQuestion, describeRequest, type PlannedStep } from "@/lib/plan";

export function ApprovePanel(props: {
  disputeId: string;
  // Which analysis the draft came from; the server refuses the send if a newer one exists.
  analysisAt: string;
  actionable: boolean;
  sent?: boolean;
  warning?: string;
  unlocked: boolean;
  // Practice case: the send is simulated in the app and nothing reaches PayPal.
  simulated?: boolean;
  // Why nothing can be sent, when the plan is empty for a reason other than PayPal's state.
  blocked?: string;
  steps: PlannedStep[];
  evidenceNotes: string;
  buyerMessage: string;
  // For the confirm question: "Refund 210.00 USD to Rosa Diaz?"
  amount: string;
  buyerName?: string;
  // An earlier send on this case, made before this analysis: this draft would go out as a follow-up.
  sentBefore?: { at: string; detail: string };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(executePlan, null);
  const [evidenceNotes, setEvidenceNotes] = useState(props.evidenceNotes);
  const [buyerMessage, setBuyerMessage] = useState(props.buyerMessage);
  const showEvidence = props.steps.some((s) => s.action.kind === "provide_evidence" || s.action.kind === "provide_supporting_info");
  const showMessage = props.steps.some((s) => s.action.kind !== "provide_evidence" && s.action.kind !== "provide_supporting_info");
  // Same edit logic the server applies, so the preview is exactly what gets sent.
  const edited = applyEdits(props.steps, { evidenceNotes, buyerMessage }).steps;
  const previews = edited.map((s) => ({
    label: s.label,
    request: describeRequest(props.disputeId, s.action),
  }));
  // Approve first asks once, inline, so a send is never one stray click. The server still re-checks everything.
  const [confirming, setConfirming] = useState(false);
  const approveRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const question = confirmQuestion(edited, { amount: props.amount, buyer: props.buyerName });
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  const cancel = () => {
    setConfirming(false);
    // Wait for the button to come back before moving focus to it.
    requestAnimationFrame(() => approveRef.current?.focus());
  };

  return (
    <form action={action} onSubmit={() => setConfirming(false)} className="rounded-lg border-2 border-ink bg-card p-5" aria-label="Review and send">
      <h2 className="font-display text-2xl font-semibold">Review and send</h2>
      <p className="mb-4 text-sm text-ink-2">Nothing goes out before you click.</p>
      <input type="hidden" name="disputeId" value={props.disputeId} />
      <input type="hidden" name="analysisAt" value={props.analysisAt} />

      {props.warning && (
        <p className="mb-4 rounded-md border border-fight bg-paper p-3 text-sm font-medium text-fight">{props.warning}</p>
      )}
      {props.sentBefore && !props.sent && props.steps.length > 0 && (
        <p className="mb-4 rounded-md border border-rule bg-paper p-3 text-sm text-ink-2">
          <strong className="text-ink">Already answered on {props.sentBefore.at}:</strong> {props.sentBefore.detail}. Approving adds the
          steps below as a follow-up; the earlier response stays with PayPal.
        </p>
      )}
      {props.steps.length === 0 ? (
        <p role={props.blocked ? "alert" : undefined} className={`mb-4 rounded-md border bg-paper p-3 text-sm ${props.blocked ? "border-fight font-medium text-fight" : "border-rule text-ink-2"}`}>
          {props.blocked ?? "PayPal is not accepting this kind of response on the dispute right now."}
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

      {/* Exactly what goes out, in full, right above the button; editing and the raw request sit below it. */}
      <div className="space-y-3">
        {showEvidence && <Draft label="To PayPal" text={evidenceNotes} />}
        {showMessage && <Draft label="To the buyer" text={buyerMessage} />}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!props.unlocked ? (
          <Link href="/unlock" className="btn btn-line">
            Unlock to send
          </Link>
        ) : props.sent || state?.ok ? (
          <span role="status" className="flex items-center gap-3">
            <span className="stamp stamp-in text-base text-accept">Sent</span>
            <span className="text-sm font-medium text-accept">{props.simulated ? "Simulated: nothing reached PayPal. The receipt is below." : "PayPal has it. The receipt is below."}</span>
          </span>
        ) : confirming ? (
          <div
            ref={confirmRef}
            tabIndex={-1}
            role="group"
            aria-labelledby="confirm-send-question"
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
            }}
            className="rise w-full rounded-md border-2 border-ink bg-paper p-3 outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <p id="confirm-send-question" className="font-medium">
              {question}
            </p>
            {props.warning && <p className="mt-1 text-sm text-fight">The evidence disagrees on this case. Sure it is right?</p>}
            {props.simulated && <p className="mt-1 text-sm text-ink-3">Practice case: simulated, nothing reaches PayPal.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className="btn btn-ink">
                {props.simulated ? "Yes, simulate the send" : "Yes, send"}
              </button>
              <button type="button" onClick={cancel} className="btn btn-line">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={approveRef}
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending || !props.actionable || props.steps.length === 0}
            className="btn btn-ink px-6 py-3 text-base"
          >
            {pending && <span className="spinner" aria-hidden />}
            {pending ? (props.simulated ? "Simulating…" : "Sending to PayPal…") : props.actionable ? "Approve and send" : "Already handled"}
          </button>
        )}
        <span className="text-xs text-ink-3">
          {props.simulated
            ? "Practice case: the send is simulated and nothing goes to PayPal. A receipt is still kept."
            : "Sent through the PayPal Disputes API. Every call is kept as a receipt."}
        </span>
      </div>

      {state &&
        (state.ok ? (
          <p className="rise mt-3 text-sm text-ink-2">{state.message}</p>
        ) : (
          <p role="alert" className="rise mt-4 rounded-md border border-fight/50 bg-paper px-3 py-2 text-sm text-fight">
            {state.message}
          </p>
        ))}
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

    </form>
  );
}

function Draft({ label, text }: { label: string; text: string }) {
  return (
    <figure className="border-l-2 border-rule pl-3">
      <figcaption className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">{label}</figcaption>
      <blockquote className="mt-0.5 text-sm leading-relaxed whitespace-pre-line break-words text-ink-2">{text || "(empty)"}</blockquote>
    </figure>
  );
}
