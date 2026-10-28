import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { getAudit } from "@/lib/records";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function AuditLog() {
  const entries = await getAudit();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl font-semibold">Audit log</h1>
      <p className="text-ink-2">Every call {PRODUCT} sent to PayPal on your behalf, with the result.</p>
      {entries.length === 0 ? (
        <p className="text-ink-3">Nothing sent yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rule bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-2 font-mono text-[11px] uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Dispute</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-t border-rule">
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDate(e.at)}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/disputes/${encodeURIComponent(e.disputeId)}`} className="underline">
                      {e.disputeId}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{e.detail}</td>
                  <td className={`px-4 py-2 ${e.ok ? "text-accept" : "text-fight"}`}>{e.ok ? (e.mode === "demo" ? "simulated" : "PayPal accepted") : e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
