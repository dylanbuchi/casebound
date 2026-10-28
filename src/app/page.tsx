import { DisputeQueue, type QueueRow } from "@/components/dispute-queue";
import { quickCallFor } from "@/lib/case";
import { needsSellerResponse } from "@/lib/dispute-state";
import { isLive } from "@/lib/env";
import { daysUntil, fmtUsd, reasonLabel, statusLabel } from "@/lib/format";
import { merchant } from "@/lib/merchant";
import { getAnalyses } from "@/lib/records";
import { source } from "@/lib/source";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function Inbox() {
  const src = source();
  const listed = await src.listDisputes().then(
    (items) => ({ items, error: null }),
    (e: unknown) => ({ items: [], error: e instanceof Error ? e.message : "Could not reach PayPal" }),
  );
  const disputes = listed.items;
  const error = listed.error;
  const analyses = await getAnalyses();

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
      winProbability: a?.assessment.win_probability ?? null,
      savings: a ? a.economics.expectedSavingsFromFighting : null,
    };
  });

  const open = rows.filter((r) => r.needsResponse);
  const atRisk = open.reduce((s, r) => s + r.amount, 0);
  const analyzed = open.filter((r) => r.verdict);
  const hoursSaved = (analyzed.length * (merchant.minutesWithoutDraft - merchant.minutesWithDraft)) / 60;
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
      </section>

      {error && (
        <p role="alert" className="rounded border border-fight bg-card p-4 text-fight">
          PayPal error: {error}
        </p>
      )}

      <section className="grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-4" aria-label="Summary">
        <Stat label="Money at risk" value={fmtUsd(atRisk)} />
        <Stat label="Soonest deadline" value={soonest === undefined ? "-" : soonest <= 0 ? "Today" : `${soonest} days`} />
        <Stat label="Analyzed" value={`${analyzed.length} of ${open.length}`} />
        <Stat label="Time saved (est.)" value={`${hoursSaved.toFixed(1)} h`} />
      </section>

      <section aria-label="Dispute queue">
        <DisputeQueue rows={rows} />
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
