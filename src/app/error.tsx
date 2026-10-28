"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PageError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="rise mx-auto max-w-xl py-12 text-center">
      <span className="stamp text-xl text-fight" aria-hidden>
        Snag
      </span>
      <h1 className="mt-6 font-display text-4xl font-semibold">This page could not load.</h1>
      <p className="mt-3 text-ink-2">
        Most often PayPal&apos;s sandbox is slow or briefly down. Nothing was sent and nothing changed. Try again in a moment.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={() => retry()} className="btn btn-ink">
          Try again
        </button>
        <Link href="/" className="btn btn-line">
          Inbox
        </Link>
      </div>
    </div>
  );
}
