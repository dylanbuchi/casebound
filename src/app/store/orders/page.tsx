import Link from "next/link";
import { StageButtons } from "@/components/stage-buttons";
import { EmptyState } from "@/components/states";
import { isUnlocked } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { listFulfillment } from "@/lib/fulfillment";

export const dynamic = "force-dynamic";

export default async function StoreOrders() {
  const [orders, unlocked] = await Promise.all([listFulfillment(), isUnlocked()]);
  const sorted = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="space-y-6">
      <Link href="/store" className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-ink-3 hover:text-ink">
        <span aria-hidden>←</span> Store
      </Link>
      <h1 className="font-display text-4xl font-semibold">Seller order tools</h1>
      <p className="max-w-2xl text-ink-2">
        Orders paid in the demo store. Use these to stage what the shop did after the sale: shipping with or without
        tracking, delivery, notes. Tracking goes to PayPal through the Shipment Tracking API.
      </p>
      {!unlocked && (
        <p className="text-sm">
          <Link href="/unlock" className="font-medium underline">
            Unlock
          </Link>{" "}
          to use these tools.
        </p>
      )}
      {sorted.length === 0 ? (
        <EmptyState mark="No orders" title="No orders yet.">
          Buy something in the{" "}
          <Link href="/store" className="underline">
            demo store
          </Link>{" "}
          with a PayPal sandbox buyer account and it shows up here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sorted.map((o) => (
            <li key={o.orderId} className="rounded-lg border border-rule bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {o.items.map((i) => i.name).join(", ")} · ${o.total}
                </p>
                <p className="font-mono text-xs text-ink-3">
                  {o.orderId} · capture {o.captureId}
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {o.buyerName} ({o.buyerEmail}) · {o.shipTo} · paid {fmtDate(o.createdAt)}
                {o.shippedAt && ` · shipped ${fmtDate(o.shippedAt)} via ${o.carrier}${o.trackingNumber ? ` ${o.trackingNumber}` : " (untracked)"}`}
                {o.deliveredAt && ` · delivered ${fmtDate(o.deliveredAt)}${o.signedBy ? `, signed ${o.signedBy}` : ""}`}
              </p>
              {o.notes?.length ? <p className="mt-1 text-xs text-ink-3">Notes: {o.notes.join(" / ")}</p> : null}
              {unlocked && (
                <div className="mt-3">
                  <StageButtons orderId={o.orderId} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
