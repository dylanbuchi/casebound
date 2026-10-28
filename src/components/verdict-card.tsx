import type { AnalysisResult } from "@/lib/agent";
import { fmtUsd, verdictColor } from "@/lib/format";
import { merchant } from "@/lib/merchant";

const verdictTitle = {
  FIGHT: "Fight it",
  ACCEPT: "Accept and refund",
  OFFER: "Make an offer",
} as const;

// The decision in one card: what to do, why, and what it costs. Money math comes from code, not the model.
export function VerdictCard({ analysis, amount, currency }: { analysis: AnalysisResult; amount: number; currency: string }) {
  const a = analysis.assessment;
  const e = analysis.economics;
  const offerCost = a.offer_type === "REPLACEMENT_WITHOUT_REFUND" ? null : (a.offer_amount ?? null);
  const options = [
    { key: "ACCEPT", label: "Refund now", value: e.acceptCost, note: "certain" },
    { key: "FIGHT", label: "Fight", value: e.fightExpectedCost, note: `expected, at ${pct(a.win_probability)} win odds` },
    ...(a.recommended_action === "OFFER"
      ? [
          {
            key: "OFFER",
            label: a.offer_type === "REPLACEMENT_WITHOUT_REFUND" ? "Replace it" : "Offer",
            value: offerCost,
            note: a.offer_type ? a.offer_type.replaceAll("_", " ").toLowerCase() : "offer",
          },
        ]
      : []),
  ] as const;
  const overridesMath = a.recommended_action !== "OFFER" && a.recommended_action !== e.cheaperOption;
  const offerOverride = a.recommended_action === "OFFER" && offerCost !== null && offerCost > Math.min(e.acceptCost, e.fightExpectedCost);

  return (
    <section aria-label="Recommendation" className="rise overflow-hidden rounded-xl border-2 border-ink bg-card">
      <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-start md:gap-8 md:p-8">
        <div className="flex flex-col items-start gap-2">
          <span className={`stamp stamp-in text-3xl md:text-4xl ${verdictColor[a.recommended_action]}`}>{a.recommended_action}</span>
          <span className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-3">Recommendation</span>
        </div>
        <div>
          <h2 className="font-display text-3xl font-semibold leading-tight md:text-4xl">{verdictTitle[a.recommended_action]}</h2>
          <p className="mt-3 max-w-3xl text-lg leading-relaxed">{a.summary}</p>
          <div className="mt-4 max-w-3xl border-l-4 border-rule pl-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Why</p>
            <p className="mt-1 leading-relaxed text-ink-2">{a.action_reasoning}</p>
          </div>
        </div>
      </div>

      <div className={`grid gap-px border-t border-rule bg-rule ${options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {options.map((o) => {
          const chosen = o.key === a.recommended_action;
          return (
            <div key={o.key} className={`px-6 py-5 ${chosen ? "bg-paper-2" : "bg-card"}`}>
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ink-3">
                {o.label}
                {chosen && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] tracking-normal text-paper normal-case">recommended</span>}
              </p>
              <p className={`mt-1 font-mono text-3xl ${chosen ? "font-bold" : ""}`}>{o.value === null ? "item cost" : fmtUsd(o.value, currency)}</p>
              <p className="text-sm text-ink-3">{o.note}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-rule px-6 py-5 md:px-8">
        <OddsBar win={a.win_probability} breakEven={analysis.breakEven} />
        <p className="text-sm text-ink-2">
          Fighting only pays off above <strong>{pct(analysis.breakEven)}</strong> win odds, counting the{" "}
          {fmtUsd(merchant.disputeFee, currency)} fee if you lose and {merchant.minutesWithDraft} minutes of your time.
          {a.recommended_action === "FIGHT" && (
            <>
              {" "}A service keeping {pct(merchant.typicalSuccessFee)} of wins would take{" "}
              <strong>{fmtUsd(amount * merchant.typicalSuccessFee, currency)}</strong> of this one. Here you keep all of it.
            </>
          )}
        </p>
        {(overridesMath || offerOverride) && (
          <p className="rounded-md border border-offer/40 bg-paper px-3 py-2 text-sm text-ink-2">
            <strong className="text-offer">Not the cheapest option.</strong> The agent chose this on fairness or the customer
            relationship, and says why above. You decide.
          </p>
        )}
      </div>
    </section>
  );
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

function OddsBar({ win, breakEven }: { win: number; breakEven: number }) {
  const winsAboveBreakEven = win >= breakEven;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-3">
        <span>
          Win odds <strong className="font-mono text-sm text-ink">{pct(win)}</strong>
        </span>
        <span>break-even {pct(breakEven)}</span>
      </div>
      <div
        className="relative h-3 rounded-full bg-paper-2"
        role="img"
        aria-label={`Win odds ${pct(win)}, break-even ${pct(breakEven)}: fighting ${winsAboveBreakEven ? "pays off" : "does not pay off"}`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${winsAboveBreakEven ? "bg-accept" : "bg-fight/70"}`}
          style={{ width: `${Math.max(2, win * 100)}%` }}
        />
        <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: `${breakEven * 100}%` }} aria-hidden />
      </div>
    </div>
  );
}
