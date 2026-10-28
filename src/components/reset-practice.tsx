"use client";

import { useActionState } from "react";
import { resetPractice, type ActionState } from "@/app/actions";

export function ResetPractice({ disputeId }: { disputeId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(resetPractice, null);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="disputeId" value={disputeId} />
      <button type="submit" disabled={pending} className="btn btn-line btn-sm rounded-full">
        {pending && <span className="spinner" aria-hidden />}
        {pending ? "Resetting…" : "Reset practice case"}
      </button>
      {state && (
        <span role="status" className={`text-xs ${state.ok ? "text-accept" : "text-fight"}`}>
          {state.ok ? "✓ " : ""}
          {state.message}
        </span>
      )}
    </form>
  );
}
