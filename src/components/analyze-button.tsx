"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = { name: string; label: string };

// Streams the agent's tool calls so the seller sees the investigation happen.
export function AnalyzeButton({ disputeId, unlocked, again }: { disputeId: string; unlocked: boolean; again?: boolean }) {
  const router = useRouter();
  const [steps, setSteps] = useState<Step[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  if (!unlocked) {
    return (
      <Link href="/unlock" className="text-sm underline">
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
          if (ev.type === "tool") setSteps((s) => [...s, { name: ev.name, label: ev.label }]);
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
      <span role="status" className="font-medium text-accept">
        Fresh analysis ✓ just now
      </span>
    );
  }

  if (again && !running && steps.length === 0) {
    return (
      <button type="button" onClick={run} className="underline hover:text-ink">
        Re-analyze
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {!again && (
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-md bg-ink px-5 py-2.5 font-medium text-paper transition hover:bg-ink-2 disabled:opacity-60"
        >
          {running ? "Investigating…" : "Investigate this dispute"}
        </button>
      )}
      {steps.length > 0 && (
        <ol className="space-y-1.5 font-mono text-sm" aria-live="polite">
          {steps.map((s, i) => (
            <li key={i} className="rise flex items-center gap-2">
              <span className={i === steps.length - 1 && running ? "animate-pulse text-offer" : "text-accept"}>
                {i === steps.length - 1 && running ? "●" : "✓"}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p role="alert" className="text-sm text-fight">
          {error}
        </p>
      )}
    </div>
  );
}
