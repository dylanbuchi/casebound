import Link from "next/link";
import { EmptyState } from "@/components/states";
import { fmtDate } from "@/lib/format";
import { getAudit, type AuditEntry } from "@/lib/records";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

const result = (e: AuditEntry) => (e.ok ? (e.mode === "demo" ? "simulated ✓" : "PayPal accepted ✓") : e.error);

export default async function AuditLog() {
  const entries = await getAudit();
  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-3">Receipts</p>
        <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">Audit log</h1>
        <p className="mt-3 max-w-2xl text-ink-2">Every call {PRODUCT} sent to PayPal on your behalf, with the result.</p>
      </header>
      {entries.length === 0 ? (
        <EmptyState mark="Blank" title="Nothing sent yet.">
          Approve a response on any case and its request and PayPal&apos;s reply land here. Practice cases are a safe place to try it.
        </EmptyState>
      ) : (
        <>
          <div className="rise hidden overflow-hidden rounded-lg border border-rule bg-card sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Dispute</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} className="border-t border-rule transition-colors hover:bg-paper">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(e.at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/disputes/${encodeURIComponent(e.disputeId)}`} className="underline underline-offset-2 hover:text-ink-2">
                        {e.disputeId}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{e.detail}</td>
                    <td className={`px-4 py-3 ${e.ok ? "text-accept" : "text-fight"}`}>{result(e)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Phones: one card per call */}
          <ul className="space-y-3 sm:hidden">
            {entries.map((e, i) => (
              <li key={i}>
                <Link href={`/disputes/${encodeURIComponent(e.disputeId)}`} className="block rounded-lg border border-rule bg-card p-4 active:bg-paper-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{e.detail}</p>
                    <p className="shrink-0 text-xs text-ink-3">{fmtDate(e.at)}</p>
                  </div>
                  <p className="mt-1 font-mono text-xs text-ink-3">{e.disputeId}</p>
                  <p className={`mt-1 text-sm ${e.ok ? "text-accept" : "text-fight"}`}>{result(e)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
