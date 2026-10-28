import Link from "next/link";

// Shared empty, error and loading pieces, drawn in the same case-file language as the rest of the app.

export function EmptyState({ mark, title, children }: { mark: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="rise flex flex-col items-center rounded-xl border border-dashed border-rule bg-card/60 px-6 py-12 text-center">
      <span className="stamp text-sm text-ink-3" aria-hidden>
        {mark}
      </span>
      <p className="mt-5 font-display text-2xl font-semibold">{title}</p>
      {children && <div className="mt-2 max-w-md text-ink-2">{children}</div>}
    </div>
  );
}

export function ErrorNotice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div role="alert" className="rise flex gap-4 rounded-lg border-2 border-fight bg-card p-5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fight font-mono text-sm font-bold text-paper" aria-hidden>
        !
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-fight">{title}</p>
        {children && <div className="mt-1 text-sm break-words text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ink-3">
      <span className="spinner" aria-hidden />
      {label}
    </p>
  );
}

export function BackToInbox() {
  return (
    <Link href="/" className="btn btn-ink">
      Back to the inbox
    </Link>
  );
}
