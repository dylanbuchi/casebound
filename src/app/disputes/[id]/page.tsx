import Link from "next/link";
import { notFound } from "next/navigation";
import { AnalyzeButton } from "@/components/analyze-button";
import { ApprovePanel } from "@/components/approve-panel";
import { QuickAccept } from "@/components/quick-accept";
import { checklistFor, quickCallFor } from "@/lib/case";
import { allowedActions } from "@/lib/dispute-state";
import type { CheckItem } from "@/lib/checklist";
import { isUnlocked } from "@/lib/auth";
import { daysUntil, fmtDate, fmtMoney, fmtUsd, reasonLabel, statusLabel, verdictColor } from "@/lib/format";
import { merchant } from "@/lib/merchant";
import { planActions } from "@/lib/plan";
import { getAnalysis, getAudit } from "@/lib/records";
import { source } from "@/lib/source";
import { PRODUCT } from "@/lib/brand";

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
  const tx = dispute.disputed_transactions?.[0];
  const due = daysUntil(dispute.seller_response_due_date);
  const allowed = allowedActions(dispute);
  const actionable = allowed.size > 0;
  const a = analysis?.assessment;
  const steps = a ? planActions(dispute, a, fulfillment) : [];
  const history = audit.filter((e) => e.disputeId === id);
  const currency = dispute.dispute_amount.currency_code;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-ink-2 hover:underline">
        ← Inbox
      </Link>

      <header className="rise flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-6">
        <div>
          <p className="font-mono text-xs tracking-wider text-ink-3">{dispute.dispute_id}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold">
            {reasonLabel[dispute.reason]} · {fmtMoney(dispute.dispute_amount)}
          </h1>
          <p className="mt-2 text-ink-2">
            {tx?.buyer?.name ?? "Buyer"} · {statusLabel(dispute.status)} · {dispute.dispute_life_cycle_stage?.toLowerCase()}
            {actionable && due !== null && (
              <span className={due <= 3 ? " font-semibold text-fight" : ""}> · respond within {due} days</span>
            )}
          </p>
        </div>
        {a && (
          <span className={`stamp stamp-in text-2xl ${verdictColor[a.recommended_action]}`}>{a.recommended_action}</span>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Case file: everything the agent can see */}
        <section aria-label="Case file" className="space-y-4">
          <Card title="Deadline and evidence">
            {actionable && dispute.seller_response_due_date ? (
              <>
                <p className={`font-mono text-2xl ${due !== null && due <= 3 ? "text-fight" : ""}`}>
                  {due !== null && due <= 0 ? "Due today" : `${due} days left`}
                </p>
                <p className="text-sm text-ink-3">
                  Respond by {fmtDate(dispute.seller_response_due_date)}. Missing it means an automatic loss.
                </p>
              </>
            ) : (
              <p className="text-ink-2">{statusLabel(dispute.status)}: no response due.</p>
            )}
            <ul className="mt-3 space-y-1.5">
              {checklist.map((c) => (
                <Check key={c.label} item={c} />
              ))}
            </ul>
          </Card>

          <Card title="Buyer's claim">
            {(dispute.messages ?? []).length === 0 ? (
              <p className="text-ink-3">No message from the buyer.</p>
            ) : (
              <ol className="space-y-3">
                {dispute.messages!.map((m, i) => (
                  <li key={i} className={m.posted_by === "SELLER" ? "pl-6" : ""}>
                    <p className="font-mono text-[11px] uppercase text-ink-3">
                      {m.posted_by.toLowerCase()} · {fmtDate(m.time_posted)}
                    </p>
                    <p className="mt-0.5">{m.content}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card title="Payment (PayPal)">
            <Dl
              rows={[
                ["Capture", payment.capture?.id ?? tx?.seller_transaction_id ?? "-"],
                ["Order", payment.order?.id ?? "-"],
                ["Paid", fmtDate(payment.capture?.create_time ?? tx?.create_time)],
                ["Items", (tx?.items ?? []).map((i) => i.item_name).join(", ") || "-"],
              ]}
            />
          </Card>

          <Card title="Tracking (PayPal)">
            {trackers.length === 0 ? (
              <p className="text-ink-3">No tracking on the PayPal transaction.</p>
            ) : (
              <ul className="space-y-1 font-mono text-sm">
                {trackers.map((t, i) => (
                  <li key={i}>
                    {t.carrier} {t.tracking_number} · <span className="font-semibold">{t.status}</span>
                  </li>
                ))}
              </ul>
            )}
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

        {/* The agent's work */}
        <section aria-label="Recommendation" className="space-y-4">
          {!a && quickCall && allowed.has("accept_claim") ? (
            <Card title="Quick call">
              <p className="text-lg leading-relaxed">
                Refunding {fmtMoney(dispute.dispute_amount)} is cheaper than fighting even if you would win 9 times out of 10.
                No agent needed.
              </p>
              <p className="mt-2 text-sm text-ink-2">
                The {fmtUsd(merchant.disputeFee, currency)} fee if you lose plus your time outweigh the amount. Accept it, or handle it
                yourself with the buyer.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                {unlocked ? (
                  <QuickAccept disputeId={id} label={`Accept and refund ${fmtMoney(dispute.dispute_amount)}`} />
                ) : (
                  <Link href="/unlock" className="text-sm underline">
                    Unlock to accept
                  </Link>
                )}
              </div>
            </Card>
          ) : !a ? (
            <Card title="Recommendation">
              <p className="text-ink-2">
                {PRODUCT} will investigate this dispute through PayPal and your shop records, estimate your odds, and
                draft the response.
              </p>
              <div className="mt-4">
                <AnalyzeButton disputeId={id} unlocked={unlocked} />
              </div>
            </Card>
          ) : (
            <>
              <Card title="Recommendation">
                <p className="text-lg leading-relaxed">{a.summary}</p>
                <p className="mt-3 text-sm text-ink-2">{a.action_reasoning}</p>
              </Card>

              <Card title="The money">
                <div className="grid grid-cols-2 gap-px overflow-hidden rounded border border-rule bg-rule">
                  <Money
                    label="Refund now"
                    value={fmtUsd(analysis!.economics.acceptCost, currency)}
                    note="certain"
                    highlight={analysis!.economics.cheaperOption === "ACCEPT"}
                  />
                  <Money
                    label="Fight (expected)"
                    value={fmtUsd(analysis!.economics.fightExpectedCost, currency)}
                    note={`${Math.round(a.win_probability * 100)}% win odds`}
                    highlight={analysis!.economics.cheaperOption === "FIGHT"}
                  />
                </div>
                <p className="mt-3 text-sm text-ink-2">
                  Fighting pays off above {Math.round(analysis!.breakEven * 100)}% odds. Includes the{" "}
                  {fmtUsd(merchant.disputeFee, currency)} fee if you lose and {merchant.minutesWithDraft} minutes of your
                  time. {a.win_probability_reasoning}
                </p>
                {a.recommended_action === "FIGHT" && (
                  <p className="mt-2 text-sm text-ink-2">
                    A service that keeps {Math.round(merchant.typicalSuccessFee * 100)}% of won disputes would take{" "}
                    {fmtUsd(Number(dispute.dispute_amount.value) * merchant.typicalSuccessFee, currency)} of this one. Here you keep
                    all of it.
                  </p>
                )}
              </Card>

              <Card title="Evidence the agent used">
                <ul className="space-y-2">
                  {a.key_facts.map((f, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          f.supports === "SELLER" ? "bg-accept" : f.supports === "BUYER" ? "bg-fight" : "bg-ink-3"
                        }`}
                        aria-label={`supports ${f.supports.toLowerCase()}`}
                      />
                      <span>
                        {f.fact} <span className="font-mono text-[11px] text-ink-3">· {sourceLabel[f.source]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {a.missing_evidence.length > 0 && (
                  <p className="mt-3 text-sm text-ink-2">
                    <span className="font-medium">Missing:</span> {a.missing_evidence.join("; ")}
                  </p>
                )}
                {a.risk_flags.length > 0 && (
                  <p className="mt-2 text-sm text-offer">
                    <span className="font-medium">Check before sending:</span> {a.risk_flags.join("; ")}
                  </p>
                )}
              </Card>

              <ApprovePanel
                disputeId={id}
                actionable={actionable}
                unlocked={unlocked}
                steps={steps}
                evidenceNotes={a.evidence_notes}
                buyerMessage={a.buyer_message}
              />

              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>
                  Analyzed {fmtDate(analysis!.createdAt)} by {analysis!.model} · {analysis!.toolCalls.length} tool calls
                </span>
                {actionable && <AnalyzeButton disputeId={id} unlocked={unlocked} again />}
              </div>
            </>
          )}

          {history.length > 0 && (
            <Card title="Receipts">
              <ul className="space-y-2 text-sm">
                {history.map((h, i) => (
                  <li key={i} className={h.ok ? "" : "text-fight"}>
                    <details>
                      <summary className="cursor-pointer">
                        <span className="font-mono text-[11px] text-ink-3">{new Date(h.at).toLocaleString("en-US")} </span>
                        {h.detail} {h.ok ? (h.mode === "demo" ? "· simulated (demo data) ✓" : "· PayPal accepted ✓") : `· failed: ${h.error}`}
                      </summary>
                      <pre className="mt-1 max-h-56 overflow-auto rounded bg-paper p-2 font-mono text-[11px] whitespace-pre-wrap break-words text-ink">
                        {JSON.stringify({ request: h.request, response: h.response }, null, 2)}
                      </pre>
                    </details>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rise rounded-lg border border-rule bg-card p-5 shadow-[0_1px_0_rgba(27,26,23,0.04)]">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">{title}</h2>
      {children}
    </div>
  );
}

const checkMark = { have: ["✓", "text-accept"], weak: ["!", "text-offer"], missing: ["✗", "text-fight"] } as const;

function Check({ item }: { item: CheckItem }) {
  const [mark, color] = checkMark[item.status];
  return (
    <li className="flex gap-2 text-sm">
      <span className={`w-4 shrink-0 font-mono font-bold ${color}`} aria-label={item.status}>
        {mark}
      </span>
      <span>
        <span className="font-medium">{item.label}</span> <span className="text-ink-2">· {item.detail}</span>
      </span>
    </li>
  );
}

function Dl({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-3">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Money({ label, value, note, highlight }: { label: string; value: string; note: string; highlight: boolean }) {
  return (
    <div className={`px-4 py-3 ${highlight ? "bg-paper-2" : "bg-card"}`}>
      <p className="text-xs uppercase tracking-wider text-ink-3">{label}</p>
      <p className={`font-mono text-2xl ${highlight ? "font-bold" : ""}`}>{value}</p>
      <p className="text-xs text-ink-3">
        {note}
        {highlight && " · cheaper"}
      </p>
    </div>
  );
}
