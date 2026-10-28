"use client";

import { useActionState } from "react";
import { resetPractice, type ActionState } from "@/app/actions";

export function ResetPractice({ disputeId }: { disputeId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(resetPractice, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="disputeId" value={disputeId} />
      <button type="submit" disabled={pending} className="rounded-full border border-ink px-3 py-1 text-xs font-medium hover:bg-paper-2 disabled:opacity-50">
        {pending ? "Resetting…" : "Reset practice case"}
      </button>
      {state && <span className={`text-xs ${state.ok ? "text-accept" : "text-fight"}`}>{state.message}</span>}
    </form>
  );
}
