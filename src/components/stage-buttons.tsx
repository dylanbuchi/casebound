"use client";

import { useActionState } from "react";
import { stageOrder, type StoreActionState } from "@/app/store/actions";

const steps = [
  { step: "ship_tracked", carrier: "USPS", label: "Ship (USPS, tracked)" },
  { step: "ship_untracked", carrier: "Royal Mail", label: "Ship untracked" },
  { step: "deliver_signed", label: "Delivered + signature" },
  { step: "deliver", label: "Delivered + photo" },
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
            <button type="submit" disabled={pending} className="btn btn-line btn-sm">
              {s.label}
            </button>
          </form>
        ))}
      </div>
      <form action={action} className="flex gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="step" value="note" />
        <input name="note" maxLength={300} placeholder="Add a staff note" aria-label="Staff note" className="field min-w-0 flex-1 px-2.5 py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="btn btn-line btn-sm">
          Add
        </button>
      </form>
      {pending && <p role="status" className="flex items-center gap-2 text-xs text-ink-3"><span className="spinner" aria-hidden />Saving…</p>}
      {state && !pending && <p role="status" className={`text-xs ${state.ok ? "text-accept" : "text-fight"}`}>{state.ok ? "✓ " : ""}{state.message}</p>}
    </div>
  );
}
