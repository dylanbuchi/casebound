"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { unlock, type ActionState } from "@/app/actions";

export function UnlockForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(unlock, null);
  useEffect(() => {
    if (state?.ok) router.push("/");
  }, [state, router]);

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium">Passcode</span>
        <input
          name="passcode"
          type="password"
          required
          autoComplete="off"
          className="mt-1 w-full rounded border border-rule bg-card p-2.5"
        />
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-ink px-5 py-2.5 font-medium text-paper disabled:opacity-60">
        {pending ? "Checking…" : "Unlock"}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-fight">
          {state.message}
        </p>
      )}
    </form>
  );
}
