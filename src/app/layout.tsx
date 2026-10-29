import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { isUnlocked, passcodeRequired } from "@/lib/auth";
import { MAKER, PRODUCT, SITE_URL } from "@/lib/brand";
import { isLive } from "@/lib/env";
import { merchant } from "@/lib/merchant";
import "./globals.css";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });
const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "700"] });

const description = "An AI case worker for PayPal disputes: investigates, does the math, drafts the response. You approve.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: PRODUCT,
  description,
  openGraph: { title: PRODUCT, description, url: SITE_URL, siteName: PRODUCT, type: "website" },
  twitter: { card: "summary_large_image", title: PRODUCT, description },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const live = isLive();
  const locked = passcodeRequired() && !(await isUnlocked());
  return (
    <html lang="en" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-rule">
          {/* One line on a phone: short labels below the sm breakpoint, full ones above. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:gap-x-6 sm:px-6 sm:py-4">
            <Link href="/" className="font-display text-lg font-semibold tracking-tight sm:text-2xl">
              {PRODUCT}
            </Link>
            <span className="hidden text-sm text-ink-2 sm:inline">
              for <span className="font-medium text-ink">{merchant.name}</span>
            </span>
            <nav className="ml-auto flex flex-wrap items-center gap-x-2.5 gap-y-2 whitespace-nowrap text-sm sm:gap-x-4">
              <Link href="/" className="hover:underline">
                Inbox
              </Link>
              <Link href="/store" className="hover:underline">
                <span className="sm:hidden">Store</span>
                <span className="hidden sm:inline">Demo store</span>
              </Link>
              <Link href="/log" className="hover:underline">
                <span className="sm:hidden">Log</span>
                <span className="hidden sm:inline">Audit log</span>
              </Link>
              <span
                className={`rounded-full border px-2 py-0.5 font-mono text-[11px] sm:px-2.5 sm:text-xs ${
                  live ? "border-accept text-accept" : "border-offer text-offer"
                }`}
                title={live ? "Connected to the PayPal sandbox" : "No PayPal credentials: showing bundled demo disputes"}
              >
                {live ? (
                  <>
                    <span className="hidden sm:inline">PayPal </span>sandbox
                  </>
                ) : (
                  "Demo data"
                )}
              </span>
              {locked && (
                <Link href="/unlock" className="font-mono text-xs underline" title="Locked: enter the passcode to analyze and send">
                  <svg viewBox="0 0 16 16" className="h-4 w-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  </svg>
                  <span className="sr-only sm:not-sr-only">Locked</span>
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
