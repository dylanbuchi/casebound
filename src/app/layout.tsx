import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { isUnlocked, passcodeRequired } from "@/lib/auth";
import { MAKER, PRODUCT } from "@/lib/brand";
import { isLive } from "@/lib/env";
import { merchant } from "@/lib/merchant";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });
const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: PRODUCT,
  description: "An AI case worker for PayPal disputes: investigates, does the math, drafts the response. You approve.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const live = isLive();
  const locked = passcodeRequired() && !(await isUnlocked());
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
            <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
              {PRODUCT}
            </Link>
            <span className="text-sm text-ink-2">
              for <span className="font-medium text-ink">{merchant.name}</span>
            </span>
            <nav className="ml-auto flex items-center gap-4 text-sm">
              <Link href="/" className="hover:underline">
                Inbox
              </Link>
              <Link href="/store" className="hover:underline">
                Demo store
              </Link>
              <Link href="/log" className="hover:underline">
                Audit log
              </Link>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${
                  live ? "border-accept text-accept" : "border-offer text-offer"
                }`}
                title={live ? "Connected to the PayPal sandbox" : "No PayPal credentials: showing bundled demo disputes"}
              >
                {live ? "PayPal sandbox" : "Demo data"}
              </span>
              {locked && (
                <Link href="/unlock" className="font-mono text-xs underline">
                  Locked
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-rule px-4 py-6 text-center text-xs text-ink-3">
          {PRODUCT}, a {MAKER} product. Sandbox only. It never moves money on its own: every action is reviewed and sent by the seller.
        </footer>
      </body>
    </html>
  );
}
