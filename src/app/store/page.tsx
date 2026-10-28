import Link from "next/link";
import { PayPalButtons } from "@/components/paypal-buttons";
import { catalog } from "@/lib/catalog";
import { env, isLive } from "@/lib/env";
import { merchant } from "@/lib/merchant";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default function Store() {
  const live = isLive();
  return (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-3">Demo store · PayPal sandbox</p>
        <h1 className="mt-1 font-display text-4xl font-semibold">{merchant.name}</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          {merchant.tagline}. This is the shop behind the disputes: buy here with a PayPal sandbox buyer account, then
          open a dispute from that account to see {PRODUCT} handle it.{" "}
          <Link href="/store/orders" className="underline">
            Seller order tools
          </Link>
        </p>
      </section>

      {!live && (
        <p className="rounded border border-offer bg-card p-4 text-offer">
          The store needs PayPal sandbox credentials. Until then, the inbox runs on demo disputes.
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {catalog.map((p) => (
          <li key={p.sku} className="rounded-lg border border-rule bg-card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">{p.name}</h2>
              <p className="font-mono">${p.price}</p>
            </div>
            <p className="mt-1 text-sm text-ink-2">{p.blurb}</p>
            {live && (
              <div className="mt-4">
                <PayPalButtons clientId={env.paypalClientId} sku={p.sku} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
