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
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Passcode</span>
        <input
          name="passcode"
          type="password"
          required
          autoComplete="off"
          className="field mt-1.5 font-mono tracking-widest"
        />
      </label>
      <button type="submit" disabled={pending} className="btn btn-ink w-full">
        {pending && <span className="spinner" aria-hidden />}
        {pending ? "Checking…" : state?.ok ? "Unlocked ✓" : "Unlock"}
      </button>
      {state && !state.ok && (
        <p role="alert" className="rise rounded-md border border-fight/50 bg-paper px-3 py-2 text-sm text-fight">
          {state.message}
        </p>
      )}
    </form>
  );
}
