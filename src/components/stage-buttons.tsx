"use client";

import { useActionState } from "react";
import { stageOrder, type StoreActionState } from "@/app/store/actions";

const steps = [
  { step: "ship_tracked", carrier: "USPS", label: "Ship (USPS, tracked)" },
  { step: "ship_untracked", carrier: "Royal Mail", label: "Ship untracked" },
  { step: "deliver_signed", label: "Delivered + signature" },
  { step: "deliver", label: "Delivered + photo" },
] as const;

const disputes = [
  { step: "dispute_inr", label: "Buyer opens dispute: not received" },
  { step: "dispute_snad", label: "Buyer opens dispute: not as described" },
] as const;

export function StageButtons({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<StoreActionState, FormData>(stageOrder, null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {steps.map((s) => (
          <form key={s.step} action={action}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="step" value={s.step} />
            {"carrier" in s && <input type="hidden" name="carrier" value={s.carrier} />}
            <button type="submit" disabled={pending} className="rounded border border-ink px-3 py-1 text-xs hover:bg-paper-2 disabled:opacity-50">
              {s.label}
            </button>
          </form>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-3">Sandbox test:</span>
        {disputes.map((d) => (
          <form key={d.step} action={action}>
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="step" value={d.step} />
            <button type="submit" disabled={pending} className="rounded border border-fight px-3 py-1 text-xs text-fight hover:bg-paper-2 disabled:opacity-50">
              {d.label}
            </button>
          </form>
        ))}
      </div>
      <form action={action} className="flex gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="step" value="note" />
        <input name="note" maxLength={300} placeholder="Add a staff note" aria-label="Staff note" className="flex-1 rounded border border-rule bg-paper px-2 py-1 text-xs" />
        <button type="submit" disabled={pending} className="rounded border border-ink px-3 py-1 text-xs disabled:opacity-50">
          Add
        </button>
      </form>
      {state && <p className={`text-xs ${state.ok ? "text-accept" : "text-fight"}`}>{state.message}</p>}
    </div>
  );
}
