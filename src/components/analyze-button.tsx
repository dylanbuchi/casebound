"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Step =
  | { kind: "tool"; name: string; label: string }
  | { kind: "lean"; lean: "FIGHT" | "ACCEPT" | "OFFER"; because: string; changed: boolean };

const leanColor = { FIGHT: "text-fight", ACCEPT: "text-accept", OFFER: "text-offer" } as const;

// Streams the agent's tool calls so the seller sees the investigation happen.
export function AnalyzeButton({ disputeId, unlocked, again }: { disputeId: string; unlocked: boolean; again?: boolean }) {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  if (!unlocked) {
    return (
      <Link href="/unlock" className={again ? "text-sm underline" : "btn btn-line"}>
        Unlock to run the analysis
      </Link>
    );
  }

  async function run() {
    setRunning(true);
    setFinished(false);
    setError(null);
    setSteps([]);
    try {
      const res = await fetch(`/api/analyze/${encodeURIComponent(disputeId)}`, { method: "POST" });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "tool") setSteps((s) => [...s, { kind: "tool", name: ev.name, label: ev.label }]);
          if (ev.type === "hypothesis") setSteps((s) => [...s, { kind: "lean", lean: ev.lean, because: ev.because, changed: ev.changed }]);
          if (ev.type === "error") throw new Error(ev.message);
          if (ev.type === "done") {
            setFinished(true);
            router.refresh();
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setRunning(false);
    }
  }

  if (again && finished && !running) {
    return (
      <span role="status" className="rise font-medium text-accept">
        Fresh analysis ✓ just now
      </span>
    );
  }

  if (again && !running && steps.length === 0) {
    return (
      <button type="button" onClick={run} className="btn btn-line btn-sm">
        Re-analyze
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {!again && (
        <button type="button" onClick={run} disabled={running} className="btn btn-ink px-6 py-3 text-base">
          {running && <span className="spinner" aria-hidden />}
          {running ? "Investigating…" : error ? "Try the investigation again" : "Investigate this dispute"}
        </button>
      )}
      {(running || steps.length > 0) && (
        <div className="rounded-md border border-rule bg-paper px-4 py-3">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
            {running ? "The agent is working the case" : finished ? "Investigation done" : "Investigation stopped"}
          </p>
          <ol className="space-y-1.5 font-mono text-sm" aria-live="polite">
            {steps.map((s, i) => {
              const live = i === steps.length - 1 && running;
              if (s.kind === "lean") {
                // A working lean is a thought, not a step; a change of mind is the moment worth seeing.
                return (
                  <li
                    key={i}
                    className={`rise my-2 rounded-md border-l-4 bg-card px-3 py-2 font-sans ${s.changed ? "border-offer" : "border-rule"}`}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
                      {s.changed ? "Changed my mind" : "Working lean"}{" "}
                      <span className={`font-bold ${leanColor[s.lean]}`}>→ {s.lean}</span>
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-ink-2">{s.because}</p>
                  </li>
                );
              }
              return (
                <li key={i} className="rise flex items-center gap-2.5">
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${live ? "text-offer" : "text-accept"}`} aria-hidden>
                    {live ? <span className="spinner" /> : "✓"}
                  </span>
                  {s.label}
                </li>
              );
            })}
            {running && steps.length === 0 && (
              <li className="flex items-center gap-2.5 text-ink-3">
                <span className="spinner" aria-hidden />
                Reading the dispute
              </li>
            )}
          </ol>
        </div>
      )}
      {error && (
        <p role="alert" className="rise rounded-md border border-fight/50 bg-paper px-3 py-2 text-sm text-fight">
          <strong>The investigation stopped.</strong> {error} Nothing was sent to PayPal.
        </p>
      )}
    </div>
  );
}
