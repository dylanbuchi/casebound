import type { AnalysisResult } from "@/lib/agent";
import { fmtUsd, verdictColor } from "@/lib/format";
import { merchant } from "@/lib/merchant";

type Action = AnalysisResult["assessment"]["recommended_action"];

const verdictTitle = {
  FIGHT: "Fight it.",
  ACCEPT: "Refund it.",
  OFFER: "Make an offer.",
} as const;

type Option = {
  key: Action;
  label: string;
  keep: number | null; // what stays with the seller, null when the cost is an item, not money
  note: string;
};

// The decision as a stamped case-file sheet, then one picture of the money: for each option, how much of
// the payment the seller keeps. Every number comes from the code-computed economics, never the model.
export function VerdictCard({
  analysis,
  amount,
  currency,
  caseId,
  historical = false,
}: {
  analysis: AnalysisResult;
  amount: number;
  currency: string;
  caseId?: string;
  historical?: boolean;
}) {
  const a = analysis.assessment;
  const e = analysis.economics;
  const p = a.win_probability;
  const offerCost = a.offer_type === "REPLACEMENT_WITHOUT_REFUND" ? null : (a.offer_amount ?? null);
  const keepIfWin = amount - e.timeCost;
  const keepIfLose = -(merchant.disputeFee + e.timeCost);

  const options: Option[] = [
    {
      key: "FIGHT",
      label: "Fight",
      keep: amount - e.fightExpectedCost,
      note: `expected, at ${pct(p)} win odds`,
    },
    { key: "ACCEPT", label: "Refund now", keep: amount - e.acceptCost, note: `you return ${fmtUsd(e.acceptCost, currency)}, certain` },
    ...(a.recommended_action === "OFFER"
      ? [
          {
            key: "OFFER" as const,
            label: a.offer_type === "REPLACEMENT_WITHOUT_REFUND" ? "Replace it" : "Offer",
            keep: offerCost === null ? null : amount - offerCost,
            note: offerCost === null ? "costs you a replacement item" : `you return ${fmtUsd(offerCost, currency)}`,
          },
        ]
      : []),
  ];
  // Recommended option first: it is the one the stamp is about.
  options.sort((x, y) => Number(y.key === a.recommended_action) - Number(x.key === a.recommended_action));

  // One scale for every bar: from the worst case (lose the fight: fee plus time) up to the full payment.
  const floor = Math.min(0, keepIfLose, ...options.map((o) => o.keep ?? 0));
  const span = amount - floor || 1;
  const at = (v: number) => ((v - floor) / span) * 100;

  const overridesMath = a.recommended_action !== "OFFER" && a.recommended_action !== e.cheaperOption;
  const offerOverride = a.recommended_action === "OFFER" && offerCost !== null && offerCost > Math.min(e.acceptCost, e.fightExpectedCost);
  const color = verdictColor[a.recommended_action];
  // When the pick is not the cheapest option, the ledger says so in money, so it never reads as a contradiction.
  const picked = options.find((o) => o.key === a.recommended_action);
  const cheapest = options.reduce<Option | null>((m, o) => (o.keep !== null && (m === null || o.keep > (m.keep ?? -Infinity)) ? o : m), null);
  const override =
    (overridesMath || offerOverride) && picked?.keep != null && cheapest && cheapest.key !== picked.key && cheapest.keep! - picked.keep > 0.005
      ? { cheaper: cheapest, gap: cheapest.keep! - picked.keep }
      : null;

  return (
    <section
      aria-label="Recommendation"
      className={`verdict-sheet relative overflow-hidden rounded-xl bg-card ${historical ? "border border-rule" : "border-2 border-ink"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule bg-paper-2/60 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3 md:px-8">
        <span>{historical ? "Historical: the recommendation made before this case closed" : "Decision"}</span>
        {caseId && <span className="normal-case tracking-wider">{caseId}</span>}
      </div>

      <div className={`relative px-5 pt-5 pb-1 md:px-8 md:pt-6 ${historical ? "opacity-85" : ""}`}>
        {/* The stamp sits over the corner of the sheet like ink on paper. */}
        <div className="mb-4 md:absolute md:top-5 md:right-8 md:mb-0" aria-hidden>
          <span className={`stamp stamp-ink stamp-in text-4xl md:text-5xl ${color}`}>{a.recommended_action}</span>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink-3">{historical ? "Was recommended" : "Recommendation"}</p>
        <h2 className="mt-1 font-display text-4xl leading-[1.05] font-semibold md:text-5xl">
          <span className="sr-only">{a.recommended_action}: </span>
          {verdictTitle[a.recommended_action]}
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed md:text-[17px]">{a.summary}</p>
        {analysis.hypotheses && analysis.hypotheses.length > 0 && <Trail hs={analysis.hypotheses} final={a.recommended_action} />}
      </div>

      {/* The money, as one picture: the full track is the payment, solid is what you keep, hatched is what you give up. */}
      <div className={`px-5 py-5 md:px-8 ${historical ? "opacity-85" : ""}`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
            What you keep of the {fmtUsd(amount, currency)} payment
          </h3>
          <Legend />
        </div>
        <ol className="space-y-4">
          {options.map((o) => {
            const chosen = o.key === a.recommended_action;
            return (
              <li key={o.key} className="grid gap-x-5 gap-y-2 md:grid-cols-[8.75rem_1fr_8rem] md:items-center">
                <div className="flex items-baseline justify-between gap-3 md:block">
                  <p className={`flex items-center gap-2 font-medium whitespace-nowrap ${chosen ? "text-ink" : "text-ink-2"}`}>
                    {o.label}
                    {chosen && (
                      <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider text-paper uppercase">
                        pick
                      </span>
                    )}
                  </p>
                  <Figure o={o} chosen={chosen} currency={currency} className="text-right md:hidden" />
                </div>
                {o.keep === null ? (
                  <p className="text-sm text-ink-3">A replacement costs you the item, not money from this payment.</p>
                ) : (
                  <KeepBar
                    keep={o.keep}
                    amount={amount}
                    at={at}
                    fill={chosen ? "bg-ink" : "bg-ink-3"}
                    tall={chosen}
                    label={`${o.label}: keep ${fmtUsd(o.keep, currency)} of ${fmtUsd(amount, currency)}, ${o.note}`}
                  />
                )}
                <Figure o={o} chosen={chosen} currency={currency} className="hidden md:block md:text-right" />
                {o.key === "FIGHT" && (
                  <div className="md:col-start-2">
                    <OddsSplit
                      win={p}
                      said={analysis.calibration && analysis.calibration.modelEstimate > p ? analysis.calibration.modelEstimate : undefined}
                      breakEven={analysis.breakEven}
                      ifWin={fmtUsd(keepIfWin, currency)}
                      ifLose={fmtUsd(keepIfLose, currency)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-3 grid md:grid-cols-[8.75rem_1fr_8rem] md:gap-x-5" aria-hidden>
          <div className="relative h-4 font-mono text-[11px] text-ink-3 md:col-start-2">
            {at(0) >= 15 && <span className="absolute left-0">{fmtUsd(floor, currency)}</span>}
            {floor < 0 && <span className="absolute -translate-x-1/2" style={{ left: `${at(0)}%` }}>$0</span>}
            <span className="absolute right-0">{fmtUsd(amount, currency)}</span>
          </div>
        </div>
        {override && (
          <p className="mt-4 rounded-md border-l-4 border-offer bg-paper px-4 py-2.5 text-sm leading-relaxed text-ink-2">
            <strong className="text-ink">
              {override.cheaper.key === "FIGHT" ? "Fighting" : override.cheaper.key === "ACCEPT" ? "Refunding" : "The offer"} is{" "}
              {fmtUsd(override.gap, currency)} cheaper on average
            </strong>
            , but {a.recommended_action === "FIGHT" ? "fighting" : a.recommended_action === "ACCEPT" ? "refunding" : "the offer"} is the pick.{" "}
            {override.cheaper.key === "FIGHT"
              ? `That average hides the likely outcome: ${p < 0.5 ? "you most likely lose" : `you lose ${pct(1 - p)} of the time`} and end at ${fmtUsd(keepIfLose, currency)}. `
              : ""}
            The agent also weighs fairness, the customer and how solid the evidence is. You decide.
          </p>
        )}
      </div>

      {/* The summary above is the short why; the full reasoning and the odds basis are one click away. */}
      <details className="border-t border-rule px-5 py-3 md:px-8">
        <summary className="cursor-pointer text-sm font-medium text-ink-2">Full reasoning, odds basis and break-even</summary>
        <div className="grid gap-4 pt-3 pb-2 md:grid-cols-[1fr_1fr] md:gap-8">
        <div className="border-l-4 border-rule pl-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Why</p>
          <p className="mt-1 leading-relaxed text-ink-2">{a.action_reasoning}</p>
        </div>
        <div className="space-y-3 text-sm text-ink-2">
          <p>
            Fighting only pays off above <strong className="text-ink">{pct(analysis.breakEven)}</strong> win odds, counting the{" "}
            {fmtUsd(merchant.disputeFee, currency)} fee if you lose and {merchant.minutesWithDraft} minutes of your time.
            {a.recommended_action === "FIGHT" && (
              <>
                {" "}A service keeping {pct(merchant.typicalSuccessFee)} of wins would take{" "}
                <strong className="text-ink">{fmtUsd(amount * merchant.typicalSuccessFee, currency)}</strong> of this one. Here you keep all of it.
              </>
            )}
          </p>
          {analysis.calibration && <OddsBasis c={analysis.calibration} />}
        </div>
      </div>
      </details>
    </section>
  );
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

const toolNames: Record<string, string> = {
  get_dispute: "the dispute",
  get_payment: "the payment",
  get_shipment_tracking: "PayPal tracking",
  get_shop_records: "your shop record",
  get_buyer_history: "buyer history",
  get_store_policy: "the policy",
  get_evidence_checklist: "the checklist",
};

// How the agent got to the stamp: its first lean, and any change of mind the evidence forced.
function Trail({ hs, final }: { hs: NonNullable<AnalysisResult["hypotheses"]>; final: Action }) {
  const flip = hs.find((h) => h.changed);
  return (
    <div className="mt-4 max-w-3xl">
      {flip && (
        <p className="mb-2 rounded-md border-l-4 border-offer bg-paper px-4 py-2.5 leading-relaxed">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-offer">Changed my mind</span>
          <span className="mt-0.5 block text-ink">
            Leaned {hs[0].lean.toLowerCase()} at first, then switched to {flip.lean.toLowerCase()}. {flip.because}
          </span>
        </p>
      )}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink-3" aria-label="How the agent got here">
        {hs.map((h, i) => (
          <li key={i} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>→</span>}
            <span title={h.because}>
              <span className={h.changed ? "font-bold text-offer" : "text-ink-2"}>{h.lean}</span>{" "}
              <span className="normal-case tracking-normal">
                after {h.afterTools.filter((t) => i === 0 || !hs[i - 1].afterTools.includes(t)).map((t) => toolNames[t] ?? t).join(", ") || "a second look"}
              </span>
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden>→</span>
          <span className="font-bold text-ink">{final}</span> <span className="normal-case tracking-normal">final</span>
        </li>
      </ol>
    </div>
  );
}

function Figure({ o, chosen, currency, className = "" }: { o: Option; chosen: boolean; currency: string; className?: string }) {
  return (
    <div className={className}>
      <p className={`font-mono leading-none tabular-nums ${chosen ? "text-3xl font-bold" : "text-xl text-ink-2"} ${o.keep !== null && o.keep < 0 ? "text-fight" : ""}`}>
        {o.keep === null ? "item" : fmtUsd(o.keep, currency)}
      </p>
      <p className="mt-1 text-xs text-ink-3">{o.note}</p>
    </div>
  );
}

function KeepBar({
  keep,
  amount,
  at,
  fill,
  tall,
  label,
}: {
  keep: number;
  amount: number;
  at: (v: number) => number;
  fill: string;
  tall: boolean;
  label: string;
}) {
  const zero = at(0);
  const kept = keep >= 0 ? { left: zero, width: at(keep) - zero } : { left: at(keep), width: zero - at(keep) };
  const lostFrom = Math.max(zero, at(keep));
  return (
    <div className={`relative ${tall ? "h-8 md:h-10" : "h-5 md:h-6"}`} role="img" aria-label={label}>
      {/* Below zero is where a lost fight lands: fee plus time. Drawn as a faint dashed zone. */}
      {zero > 0 && <div className="absolute inset-y-0 left-0 rounded-l-sm border border-dashed border-rule" style={{ width: `${zero}%` }} />}
      <div className="absolute inset-y-0 right-0 rounded-r-sm bg-paper-2" style={{ left: `${zero}%` }} />
      {/* Hatched: the part of the payment that goes back to the buyer. */}
      <div className="lost-hatch absolute inset-y-0 rounded-r-sm" style={{ left: `${lostFrom}%`, width: `${at(amount) - lostFrom}%` }} />
      <div
        className={`absolute inset-y-0 ${keep >= 0 ? fill : "bg-fight"} ${keep >= 0 ? "rounded-r-sm" : "rounded-l-sm"}`}
        style={{ left: `${kept.left}%`, width: `${Math.max(kept.width, keep === 0 ? 0 : 0.6)}%`, transformOrigin: keep >= 0 ? "left" : "right" }}
      />
      {/* Zero line, only when the scale reaches below it */}
      {zero > 0 && <div className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${zero}%` }} />}
    </div>
  );
}

// Where the win odds come from, so a number never looks more certain than its evidence.
function OddsBasis({ c }: { c: NonNullable<AnalysisResult["calibration"]> }) {
  const lowered = c.calibrated < c.modelEstimate;
  const weak = c.basis.filter((b) => b.effect > 0);
  return (
    <div className={`rounded-md border px-3 py-2 ${lowered ? "border-offer/50 bg-paper" : "border-rule"}`}>
      <p>
        {lowered ? (
          <>
            <strong className="text-offer">Odds lowered to {pct(c.calibrated)}.</strong> The agent said {pct(c.modelEstimate)}, but{" "}
            {weak.length === 1 ? "one key fact rests" : `${weak.length} key facts rest`} on your own records or {weak.length === 1 ? "is" : "are"} unconfirmed, so
            the code caps it at {pct(c.cap)}.
          </>
        ) : (
          <>
            <strong className="text-ink">{pct(c.calibrated)} win odds</strong>, within the {pct(c.cap)} the evidence on file supports.
          </>
        )}
      </p>
      <details className="mt-1">
        <summary className="cursor-pointer text-ink-3">Based on</summary>
        <ul className="mt-1 space-y-0.5">
          {c.basis.map((b) => (
            <li key={b.label} className="flex justify-between gap-3">
              <span>
                {b.label} <span className="text-ink-3">· {b.why}</span>
              </span>
              <span className={`font-mono tabular-nums ${b.effect > 0 ? "text-offer" : "text-accept"}`}>
                {b.effect > 0 ? `−${Math.round(b.effect * 100)}` : "✓"}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function OddsSplit({
  win,
  said,
  breakEven,
  ifWin,
  ifLose,
}: {
  win: number;
  said?: number;
  breakEven: number;
  ifWin: string;
  ifLose: string;
}) {
  const pays = win >= breakEven;
  return (
    <div className="text-xs text-ink-2">
      <div
        className="relative flex h-1.5 overflow-visible rounded-full bg-paper-2"
        role="img"
        aria-label={`Win odds ${pct(win)}, break-even ${pct(breakEven)}: fighting ${pays ? "pays off" : "does not pay off"}`}
      >
        <div className={`h-full rounded-l-full ${pays ? "bg-accept" : "bg-fight/70"}`} style={{ width: `${Math.max(1, win * 100)}%` }} />
        {/* What the agent claimed before the evidence cap, drawn as an empty dashed stretch. */}
        {said !== undefined && (
          <div
            className="absolute inset-y-0 rounded-r-full border border-dashed border-ink-3"
            style={{ left: `${win * 100}%`, width: `${(said - win) * 100}%` }}
            aria-hidden
          />
        )}
        <div className="absolute -top-1 -bottom-1 w-0.5 bg-ink" style={{ left: `${breakEven * 100}%` }} aria-hidden />
      </div>
      <p className="mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-0.5">
        <span>
          <strong className="font-mono text-ink">{pct(win)}</strong> win{said !== undefined && <span className="text-ink-3"> (agent said {pct(said)})</span>}: keep {ifWin}
        </span>
        <span className="text-ink-3">break-even {pct(breakEven)}</span>
        <span>
          <strong className="font-mono text-ink">{pct(1 - win)}</strong> lose: {ifLose} with the fee
        </span>
      </p>
    </div>
  );
}

function Legend() {
  return (
    <p className="flex gap-4 text-xs text-ink-3" aria-hidden>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-4 rounded-sm bg-ink-3" />
        you keep
      </span>
      <span className="flex items-center gap-1.5">
        <span className="lost-hatch inline-block h-2.5 w-4 rounded-sm" />
        goes to the buyer
      </span>
    </p>
  );
}
