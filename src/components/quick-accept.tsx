"use client";

import { useActionState } from "react";
import { quickAccept, type ActionState } from "@/app/actions";

export function QuickAccept({ disputeId, label }: { disputeId: string; label: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(quickAccept, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="disputeId" value={disputeId} />
      <button
        type="submit"
        disabled={pending || state?.ok === true}
        className="btn btn-accept"
      >
        {pending && <span className="spinner" aria-hidden />}
        {pending ? "Sending to PayPal…" : state?.ok ? "Refund sent ✓" : label}
      </button>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "font-medium text-accept" : "text-fight"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
