import Link from "next/link";
import { PayPalButtons } from "@/components/paypal-buttons";
import { isUnlocked } from "@/lib/auth";
import { catalog } from "@/lib/catalog";
import { env, isLive } from "@/lib/env";
import { merchant } from "@/lib/merchant";
import { PRODUCT } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function Store() {
  const live = isLive();
  const unlocked = await isUnlocked();
  return (
    <div className="storefront space-y-8 p-6 sm:p-10">
      <p className="rounded-full bg-[var(--shop-accent)] px-4 py-1.5 text-center text-xs font-medium text-white">
        Demo shop on the PayPal sandbox. No real money moves.
      </p>
      <section className="text-center">
        <h1 className="font-display text-5xl font-light italic tracking-tight">{merchant.name}</h1>
        <p className="mx-auto mt-3 max-w-2xl text-[color:var(--shop-ink)]/80">
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
          <li key={p.sku} className="rounded-2xl border border-black/10 bg-[#f7f9f7] p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-xl font-semibold">{p.name}</h2>
              <p className="font-mono">${p.price}</p>
            </div>
            <p className="mt-1 text-sm text-ink-2">{p.blurb}</p>
            {live &&
              (unlocked ? (
                <div className="mt-4">
                  <PayPalButtons clientId={env.paypalClientId} sku={p.sku} />
                </div>
              ) : (
                <Link href="/unlock" className="mt-4 inline-block text-sm underline">
                  Enter the passcode to buy
                </Link>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
