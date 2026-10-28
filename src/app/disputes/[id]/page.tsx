import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzeButton } from "@/components/analyze-button";
import { ApprovePanel } from "@/components/approve-panel";
import { QuickAccept } from "@/components/quick-accept";
import { VerdictCard } from "@/components/verdict-card";
import { checklistFor, quickCallFor } from "@/lib/case";
import { allowedActions } from "@/lib/dispute-state";
import { conflictsIn, type CheckItem } from "@/lib/checklist";
import { isUnlocked } from "@/lib/auth";
import { daysUntil, fmtDate, fmtMoney, fmtUsd, reasonLabel, statusLabel, windowUsed } from "@/lib/format";
import { merchant } from "@/lib/merchant";
import { planActions } from "@/lib/plan";
import { getAnalysis, getAudit } from "@/lib/records";
import { isPractice, source } from "@/lib/source";
import { ResetPractice } from "@/components/reset-practice";
import { PRODUCT } from "@/lib/brand";
import type { AnalysisResult } from "@/lib/agent";

export const dynamic = "force-dynamic";

const sourceLabel = {
  paypal_dispute: "PayPal dispute",
  paypal_payment: "PayPal payment",
  paypal_tracking: "PayPal tracking",
  shop_records: "Shop records",
  store_policy: "Store policy",
  buyer_history: "Buyer history",
} as const;

export default async function DisputePage({ params }: PageProps<"/disputes/[id]">) {
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) notFound();
  const src = source();
  const dispute = await src.getDispute(id).catch(() => null);
  if (!dispute) notFound();

  const [payment, trackers, fulfillment, analysis, audit, unlocked] = await Promise.all([
    src.getPayment(dispute),
    src.getTrackers(dispute),
    src.getFulfillment(dispute),
    getAnalysis(id),
    getAudit(),
    isUnlocked(),
  ]);

  const checklist = await checklistFor(src, dispute, trackers, fulfillment);
  const quickCall = quickCallFor(dispute);
  const conflicts = conflictsIn(checklist);
  const tx = dispute.disputed_transactions?.[0];
  const due = daysUntil(dispute.seller_response_due_date);
  const allowed = allowedActions(dispute);
  const actionable = allowed.size > 0;
  const a = analysis?.assessment;
  const steps = a ? planActions(dispute, a, fulfillment) : [];
  const history = audit.filter((e) => e.disputeId === id);
  const currency = dispute.dispute_amount.currency_code;

  const outcome = dispute.dispute_outcome ?? dispute.outcome;
  const used = windowUsed(dispute.create_time, dispute.seller_response_due_date);
  const urgent = actionable && due !== null && due <= 3;
  const resolved = dispute.status === "RESOLVED";
  const wonBySeller = Boolean(outcome?.outcome_code?.includes("SELLER"));

  // The send column: source check, approval and receipts. Sits beside the verdict so Approve is in the first view.
  const sendColumn = (
    <>
      {a && (actionable || history.length === 0) && (
        <ApprovePanel
          disputeId={id}
          actionable={actionable}
          sent={history.some((h) => h.ok && h.at > analysis!.createdAt)}
          warning={conflicts.length > 0 ? "Some evidence conflicts. Open “The evidence disagrees” and check it before approving." : undefined}
          unlocked={unlocked}
          steps={steps}
          evidenceNotes={a.evidence_notes}
          buyerMessage={a.buyer_message}
        />
      )}

      {analysis?.grounding && <GroundingNote g={analysis.grounding} />}

      {history.length > 0 && (
        <section aria-label="Receipts" className="rounded-lg border-2 border-accept/60 bg-card p-5">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Receipts: what was sent to PayPal</h2>
          <ul className="space-y-3">
            {history.map((h, i) => (
              <li key={i}>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={h.ok ? "accept" : "fight"}>
                    {h.ok ? (h.mode === "demo" ? "simulated ✓" : "PayPal accepted ✓") : "PayPal rejected"}
                  </Pill>
                  <span className="font-medium">{h.detail}</span>
                  <span className="font-mono text-[11px] text-ink-3">{new Date(h.at).toLocaleString("en-US")}</span>
                </div>
                {!h.ok && <p className="mt-1 text-sm text-fight">{h.error}</p>}
                <details className="mt-1">
                  <summary className="cursor-pointer text-sm text-ink-2">Request and PayPal&apos;s reply</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded bg-ink p-3 font-mono text-[11px] leading-snug whitespace-pre-wrap break-words text-paper">
                    {JSON.stringify({ request: h.request, response: h.response }, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
          <span>
            Analyzed {new Date(analysis!.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} by{" "}
            {analysis!.model} · {analysis!.toolCalls.length} tool calls
          </span>
          {actionable && <AnalyzeButton disputeId={id} unlocked={unlocked} again />}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-ink-3 hover:text-ink">
        <span aria-hidden>←</span> Inbox
      </Link>

      <header className="border-b border-rule pb-5">
        {isPractice(id) && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-offer bg-card px-4 py-2 text-sm">
            <span className="font-semibold text-offer">Practice case</span>
            <span className="text-ink-2">Bundled sample data. Sends are simulated and never reach PayPal.</span>
            {unlocked && <ResetPractice disputeId={id} />}
          </div>
        )}
        <p className="font-mono text-xs tracking-wider text-ink-3">{dispute.dispute_id}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">
          {reasonLabel[dispute.reason]} · {fmtMoney(dispute.dispute_amount)}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-ink-2">
          <span>{tx?.buyer?.name ?? "Buyer"}</span>
          <span aria-hidden>·</span>
          <Pill tone={actionable ? "ink" : "muted"}>{statusLabel(dispute.status)}</Pill>
          {actionable && due !== null && (
            <Pill tone={urgent ? "fight" : "muted"}>{due <= 0 ? "respond today" : `${due} day${due === 1 ? "" : "s"} to respond`}</Pill>
          )}
          {dispute.dispute_life_cycle_stage && <Pill tone="muted">{dispute.dispute_life_cycle_stage.toLowerCase()}</Pill>}
          {outcome?.outcome_code && (
            <Pill tone={outcome.outcome_code.includes("SELLER") ? "accept" : "muted"}>
              {outcome.outcome_code.includes("SELLER") ? "won" : "resolved for buyer"}
              {outcome.amount_refunded ? ` · refunded ${fmtMoney(outcome.amount_refunded)}` : ""}
            </Pill>
          )}
        </div>
      </header>

      {/* A closed case leads with how it ended; the analysis below is history. */}
      {resolved && (
        <section aria-label="Outcome" className="rounded-xl border-2 border-ink bg-card p-6 md:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-3">Final outcome</p>
          <h2 className="mt-2 font-display text-3xl font-semibold md:text-4xl">
            {wonBySeller ? "Won: PayPal decided for you" : "Closed in the buyer's favour"}
          </h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-2">
            {outcome?.amount_refunded
              ? `${fmtMoney(outcome.amount_refunded)} was refunded to the buyer${outcome && "outcome_reason" in outcome && outcome.outcome_reason ? ` (${String(outcome.outcome_reason).toLowerCase().replaceAll("_", " ")})` : ""}.`
              : wonBySeller
                ? "You keep the payment."
                : "No refund amount was reported."}{" "}
            {history.length > 0 && `${PRODUCT} sent ${history.filter((h) => h.ok).length} response${history.filter((h) => h.ok).length === 1 ? "" : "s"} for you; the receipts are below.`}
          </p>
        </section>
      )}

      {/* The decision first: verdict and ledger beside the approval, so both fit the first view on a desktop */}
      {a ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
          <VerdictCard analysis={analysis!} caseId={dispute.dispute_id} amount={Number(dispute.dispute_amount.value)} currency={currency} historical={resolved} />
          <section aria-label="Response" className="min-w-0 space-y-4">
            {sendColumn}
          </section>
        </div>
      ) : quickCall && allowed.has("accept_claim") ? (
        <section className="rounded-xl border-2 border-accept bg-card p-6 md:p-8" aria-label="Quick call">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accept">Quick call, no AI needed</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Refund it. Fighting can&apos;t pay off.</h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed">
            Refunding {fmtMoney(dispute.dispute_amount)} is cheaper than fighting even if you would win 9 times out of 10: the{" "}
            {fmtUsd(merchant.disputeFee, currency)} fee if you lose plus your time outweigh the amount.
          </p>
          <div className="mt-5">
            {unlocked ? (
              <QuickAccept disputeId={id} label={`Accept and refund ${fmtMoney(dispute.dispute_amount)}`} />
            ) : (
              <Link href="/unlock" className="btn btn-line">
                Unlock to accept
              </Link>
            )}
          </div>
        </section>
      ) : actionable ? (
        <section className="rounded-xl border-2 border-ink bg-card p-6 md:p-8" aria-label="Investigate">
          <h2 className="font-display text-3xl font-semibold">Should you fight this one?</h2>
          <p className="mt-2 max-w-2xl text-lg text-ink-2">
            {PRODUCT} reads the dispute, the payment, tracking and your shop records, works out your odds and the money at stake,
            and drafts the response. Nothing is sent until you approve it.
          </p>
          <div className="mt-5">
            <AnalyzeButton disputeId={id} unlocked={unlocked} />
          </div>
        </section>
      ) : null}

      {conflicts.length > 0 && (
        <details aria-label="Conflicting evidence" className="rounded-lg border-2 border-fight bg-card px-5 py-3">
          <summary className="cursor-pointer font-semibold text-fight">
            The evidence disagrees on {conflicts.length} point{conflicts.length === 1 ? "" : "s"}. Verify before you send.
          </summary>
          <ul className="mt-2 mb-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {conflicts.map((c) => (
              <li key={c.label}>
                <span className="font-medium text-ink">{c.label}:</span> {c.detail}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        {/* Case file: everything the agent can see */}
        <section aria-label="Case file" className="min-w-0 space-y-4">
          <details className={`rounded-lg border-2 bg-card px-5 py-4 ${urgent ? "border-fight" : "border-rule"}`} open={!a}>
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Deadline and what a PayPal reviewer looks for
            </summary>
            {actionable && dispute.seller_response_due_date ? (
              <>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
                  <p className={`font-mono text-4xl font-bold ${urgent ? "text-fight" : ""}`}>
                    {due !== null && due <= 0 ? "Due today" : `${due} days`}
                  </p>
                  <p className="text-sm text-ink-2">
                    to respond, by {fmtDate(dispute.seller_response_due_date)}. Missing it is an automatic loss.
                  </p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-paper-2" role="img" aria-label={`${Math.round(used * 100)}% of the response window used`}>
                  <div className={`h-full rounded-full ${urgent ? "bg-fight" : "bg-ink"}`} style={{ width: `${Math.max(2, used * 100)}%` }} />
                </div>
              </>
            ) : (
              <p className="mt-3 text-ink-2">{statusLabel(dispute.status)}: no response due from you right now.</p>
            )}
            <h3 className="mt-5 mb-2 text-sm font-semibold">What a PayPal reviewer will look for</h3>
            <ul className="space-y-2">
              {checklist.map((c) => (
                <Check key={c.label} item={c} />
              ))}
            </ul>
          </details>

          <Card title="Buyer's claim">
            {(dispute.messages ?? []).length === 0 ? (
              <p className="text-ink-3">No message from the buyer.</p>
            ) : (
              <ol className="space-y-3">
                {dispute.messages!.map((m, i) => (
                  <li key={i} className={m.posted_by === "SELLER" ? "border-l-2 border-rule pl-4" : ""}>
                    <p className="font-mono text-[11px] uppercase text-ink-3">
                      {m.posted_by.toLowerCase()} · {fmtDate(m.time_posted)}
                    </p>
                    <p className="mt-0.5 text-[15px]">“{m.content}”</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Payment and tracking (PayPal)">
            <Dl
              rows={[
                ["Capture", payment.capture?.id ?? tx?.seller_transaction_id ?? "-"],
                ["Order", payment.order?.id ?? "-"],
                ["Paid", fmtDate(payment.capture?.create_time ?? tx?.create_time)],
                ["Items", (tx?.items ?? []).map((i) => i.item_name).join(", ") || "-"],
                [
                  "Tracking",
                  trackers.length === 0
                    ? "None on the PayPal transaction"
                    : trackers.map((t) => `${t.carrier ?? ""} ${t.tracking_number} · ${t.status}`.trim()).join(", "),
                ],
              ]}
            />
          </Card>

          <Card title="Shop records">
            {fulfillment ? (
              <>
                <Dl
                  rows={[
                    ["Ship to", fulfillment.shipTo],
                    ["Carrier", fulfillment.carrier ?? "-"],
                    ["Shipped", fmtDate(fulfillment.shippedAt)],
                    ["Delivered", fmtDate(fulfillment.deliveredAt)],
                    ["Signed by", fulfillment.signedBy ?? "-"],
                    ["Refunds", fulfillment.refunds?.map((r) => `${r.refundId} (${r.amount})`).join(", ") || "-"],
                  ]}
                />
                {fulfillment.notes?.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-2">
                    {fulfillment.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              <p className="text-ink-3">No shop record matches this payment.</p>
            )}
          </Card>
        </section>

        {/* The agent's evidence, the send step and the receipts */}
        <section aria-label="Evidence" className="min-w-0 space-y-4">
          {!a && sendColumn}
          {a && (
            <Card title={`Evidence the agent used (${a.key_facts.length} facts)`} folded>
              <ul className="space-y-2.5">
                {a.key_facts.slice(0, 6).map((f, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-snug">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        f.supports === "SELLER" ? "bg-accept" : f.supports === "BUYER" ? "bg-fight" : "bg-ink-3"
                      }`}
                      role="img"
                      aria-label={`supports ${f.supports.toLowerCase()}`}
                    />
                    <span>
                      {f.fact} <span className="whitespace-nowrap font-mono text-[11px] text-ink-3">· {sourceLabel[f.source]}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {a.key_facts.length > 6 && (
                <details className="mt-2.5">
                  <summary className="cursor-pointer text-sm text-ink-2">Show all {a.key_facts.length} facts</summary>
                  <ul className="mt-2.5 space-y-2.5">
                    {a.key_facts.slice(6).map((f, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-snug">
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                            f.supports === "SELLER" ? "bg-accept" : f.supports === "BUYER" ? "bg-fight" : "bg-ink-3"
                          }`}
                          role="img"
                          aria-label={`supports ${f.supports.toLowerCase()}`}
                        />
                        <span>
                          {f.fact} <span className="whitespace-nowrap font-mono text-[11px] text-ink-3">· {sourceLabel[f.source]}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="mt-3 flex flex-wrap gap-4 text-xs text-ink-3">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-accept" />helps you</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-fight" />helps the buyer</span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-ink-3" />neutral</span>
              </p>
              {a.risk_flags.length > 0 && (
                <div className="mt-4 rounded-md border border-offer/40 bg-paper p-3">
                  <p className="text-sm font-semibold text-offer">Check before sending</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">
                    {a.risk_flags.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  {a.risk_flags.length > 3 && (
                    <details className="mt-1 text-sm text-ink-2">
                      <summary className="cursor-pointer">{a.risk_flags.length - 3} more</summary>
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {a.risk_flags.slice(3).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              {a.missing_evidence.length > 0 && (
                <details className="mt-3 text-sm text-ink-2">
                  <summary className="cursor-pointer font-medium">Missing evidence ({a.missing_evidence.length})</summary>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {a.missing_evidence.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

const fieldLabel: Record<string, string> = {
  summary: "Summary",
  win_probability_reasoning: "Odds reasoning",
  action_reasoning: "Why",
  evidence_notes: "Response to PayPal",
  buyer_message: "Message to the buyer",
};

// The code-side source check: what the agent had to rewrite, and what was cut because no record backs it.
function GroundingNote({ g }: { g: NonNullable<AnalysisResult["grounding"]> }) {
  if (g.removed.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-rule bg-card px-4 py-3 text-sm text-ink-2">
        <span className="font-mono text-accept" aria-hidden>✓</span>
        <span>
          Delivery, signature and reference-number claims in this reply match PayPal tracking or your shop record.
          {g.sentBack > 0 && ` The agent rewrote ${g.sentBack} that claimed more than those records show.`} Other wording is not checked by code.
        </span>
      </p>
    );
  }
  return (
    <details aria-label="Removed claims" className="rounded-lg border-2 border-offer bg-card px-5 py-3">
      <summary className="cursor-pointer font-semibold text-offer">
        Removed {g.removed.length} claim{g.removed.length === 1 ? "" : "s"} no record backs
      </summary>
      <p className="mt-1 text-sm text-ink-2">
        {g.sentBack > 0 ? "The agent was asked to fix these once and did not. " : ""}They are not in the drafts.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {g.removed.map((r, i) => (
          <li key={i} className="border-l-2 border-offer/50 pl-3">
            <p className="text-ink-3 line-through decoration-offer/60">“{r.text}”</p>
            <p className="text-ink-2">
              <span className="font-mono text-[11px] uppercase text-ink-3">{fieldLabel[r.where] ?? "Evidence list"}</span> · {r.reason}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Pill({ tone, children }: { tone: "ink" | "muted" | "accept" | "fight"; children: React.ReactNode }) {
  const cls = {
    ink: "border-ink text-ink",
    muted: "border-rule text-ink-2",
    accept: "border-accept bg-accept text-paper",
    fight: "border-fight bg-fight text-paper",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Card({ title, folded = false, children }: { title: string; folded?: boolean; children: React.ReactNode }) {
  if (folded) {
    return (
      <details className="rounded-lg border border-rule bg-card px-5 py-4 shadow-[0_1px_0_rgba(27,26,23,0.04)]">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">{title}</summary>
        <div className="mt-3">{children}</div>
      </details>
    );
  }
  return (
    <div className="rounded-lg border border-rule bg-card p-5 shadow-[0_1px_0_rgba(27,26,23,0.04)]">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">{title}</h2>
      {children}
    </div>
  );
}

const checkMark = {
  have: ["✓", "bg-accept text-paper", "on file"],
  weak: ["!", "bg-offer text-paper", "weak"],
  missing: ["✗", "bg-fight text-paper", "missing"],
} as const;

function Check({ item }: { item: CheckItem }) {
  const [mark, color, label] = checkMark[item.status];
  return (
    <li className="flex gap-3 text-sm">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${color}`}
        role="img"
        aria-label={label}
      >
        {mark}
      </span>
      <span>
        <span className="font-medium">{item.label}</span>{" "}
        <span className="rounded border border-rule px-1 py-px font-mono text-[10px] uppercase tracking-wider text-ink-3">{item.source}</span>
        <span className="block text-ink-2">{item.detail}</span>
      </span>
    </li>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
