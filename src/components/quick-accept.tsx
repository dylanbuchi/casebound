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
        className="rounded-md bg-accept px-5 py-2.5 font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending to PayPal…" : label}
      </button>
      {state && (
        <p role="status" className={`text-sm ${state.ok ? "text-accept" : "text-fight"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
