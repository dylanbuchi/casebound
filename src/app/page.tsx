import Link from "next/link";
import { DisputeQueue, type QueueRow } from "@/components/dispute-queue";
import { quickCallFor } from "@/lib/case";
import { needsSellerResponse } from "@/lib/dispute-state";
import { isLive } from "@/lib/env";
import { daysUntil, fmtUsd, reasonLabel, statusLabel } from "@/lib/format";
import { merchant } from "@/lib/merchant";
import { getAnalyses, getAudit } from "@/lib/records";
import { isUnlocked, passcodeRequired } from "@/lib/auth";
import { isPractice, source } from "@/lib/source";
import { PRODUCT } from "@/lib/brand";
import { EmptyState, ErrorNotice } from "@/components/states";

export const dynamic = "force-dynamic";

const verdictBg = { FIGHT: "bg-fight", ACCEPT: "bg-accept", OFFER: "bg-offer" } as const;

export default async function Inbox() {
  const src = source();
  const listed = await src.listDisputes().then(
    (items) => ({ items, error: null }),
    (e: unknown) => ({ items: [], error: e instanceof Error ? e.message : "Could not reach PayPal" }),
  );
  const disputes = listed.items;
  const error = listed.error;
  const [analyses, audit, unlocked] = await Promise.all([getAnalyses(), getAudit(), isUnlocked()]);

  const rows: QueueRow[] = disputes.map((d) => {
    const a = analyses[d.dispute_id];
    return {
      id: d.dispute_id,
      amount: Number(d.dispute_amount.value),
      currency: d.dispute_amount.currency_code,
      reason: reasonLabel[d.reason] ?? d.reason,
      stage: d.dispute_life_cycle_stage ?? "-",
      status: statusLabel(d.status),
      needsResponse: needsSellerResponse(d),
      dueInDays: daysUntil(d.seller_response_due_date),
      verdict: a?.assessment.recommended_action ?? null,
      quickCall: !a && quickCallFor(d),
      practice: isPractice(d.dispute_id),
      winProbability: a?.assessment.win_probability ?? null,
      savings: a ? a.economics.expectedSavingsFromFighting : null,
    };
  });

  const open = rows.filter((r) => r.needsResponse);
  const next = [...open].sort((x, y) => (x.dueInDays ?? 99) - (y.dueInDays ?? 99))[0] ?? rows[0];
  const atRisk = open.reduce((s, r) => s + r.amount, 0);
  const analyzedCount = rows.filter((r) => r.verdict).length;
  const hoursSaved = (analyzedCount * (merchant.minutesWithoutDraft - merchant.minutesWithDraft)) / 60;
  const sent = audit.filter((e) => e.ok && rows.some((r) => r.id === e.disputeId)).length;
  const soonest = open.map((r) => r.dueInDays).filter((n): n is number => n !== null).sort((a, b) => a - b)[0];

  return (
    <div className="space-y-8">
      <section className="rise">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-3">Dispute inbox</p>
        <h1 className="mt-1 max-w-3xl font-display text-4xl leading-tight font-semibold sm:text-5xl">
          {open.length === 0
            ? "No disputes need you right now."
            : `${open.length} dispute${open.length === 1 ? "" : "s"} need${open.length === 1 ? "s" : ""} an answer.`}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-2">
          {PRODUCT} reads each PayPal dispute, checks tracking and your shop records, works out whether fighting is
          worth it, and drafts the reply. Nothing is sent until you approve it.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {next && (
            <Link href={`/disputes/${encodeURIComponent(next.id)}`} className="btn btn-ink px-6 py-3">
              Open the next case →
            </Link>
          )}
          {passcodeRequired() && !unlocked && (
            <Link href="/unlock" className="btn btn-line px-6 py-3">
              Unlock to analyze and send
            </Link>
          )}
        </div>
        <ul className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="How it works">
          <li className="rounded-full border border-rule bg-card px-3 py-1">Fight, accept or offer, with the math shown</li>
          <li className="rounded-full border border-rule bg-card px-3 py-1">You approve every send, with a receipt</li>
          <li className="rounded-full border border-rule bg-card px-3 py-1">Deadlines and evidence gaps up front</li>
        </ul>
      </section>

      {error && (
        <ErrorNotice title="PayPal did not answer, so the live disputes are missing.">
          {error}. Practice cases still work. Reload in a minute to try again.
        </ErrorNotice>
      )}

      <section className="grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4" aria-label="Summary">
        <Stat label="Money at risk" value={fmtUsd(atRisk)} />
        <Stat label="Soonest deadline" value={soonest === undefined ? "-" : soonest <= 0 ? "Today" : `${soonest} days`} />
        <Stat label="Responses sent" value={String(sent)} />
        <Stat label="Time saved (est.)" value={`${hoursSaved.toFixed(1)} h`} />
      </section>

      <section aria-label="Dispute queue">
        {rows.length === 0 && (
          <EmptyState mark="Clear" title="Your inbox is empty.">
            When a buyer opens a PayPal dispute, it shows up here with a deadline and a recommendation. Try it from the{" "}
            <Link href="/store" className="underline">
              demo store
            </Link>
            .
          </EmptyState>
        )}
        <div className={rows.length === 0 ? "hidden" : "hidden sm:block"}>
          <DisputeQueue rows={rows} />
        </div>
        {/* Phones get one card per case instead of a wide table. */}
        <ul className="space-y-3 sm:hidden">
          {[...rows]
            .sort((x, y) => Number(y.needsResponse) - Number(x.needsResponse) || (x.dueInDays ?? 99) - (y.dueInDays ?? 99))
            .map((r) => (
              <li key={r.id}>
                <Link href={`/disputes/${encodeURIComponent(r.id)}`} className="block rounded-lg border border-rule bg-card p-4 transition-colors active:bg-paper-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {r.reason}
                      {r.practice && <span className="ml-2 rounded-full border border-offer px-2 py-0.5 text-[11px] text-offer">Practice</span>}
                    </p>
                    <p className="font-mono">{fmtUsd(r.amount, r.currency)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                    {r.verdict ? (
                      <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold text-paper ${verdictBg[r.verdict]}`}>{r.verdict}</span>
                    ) : r.quickCall && r.needsResponse ? (
                      <span className="text-accept">Quick call: accept</span>
                    ) : (
                      <span className="text-ink-3">Not analyzed</span>
                    )}
                    <span>{r.status}</span>
                    {r.needsResponse && r.dueInDays !== null && (
                      <span className={r.dueInDays <= 3 ? "font-semibold text-fight" : ""}>· {r.dueInDays} days left</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
        </ul>
        {!isLive() && (
          <p className="mt-3 text-sm text-ink-3">
            Showing bundled demo disputes. Add PayPal sandbox credentials to work with real sandbox disputes.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-ink-3">{label}</p>
      <p className="mt-1 font-mono text-2xl">{value}</p>
    </div>
  );
}
