import { UnlockForm } from "@/components/unlock-form";
import { unlockPossible } from "@/lib/auth";
import { PRODUCT } from "@/lib/brand";

export default function Unlock() {
  return (
    <div className="rise mx-auto max-w-md py-6 sm:py-12">
      <div className="relative rounded-xl border-2 border-ink bg-card p-6 sm:p-8">
        <span className="stamp absolute -top-4 right-5 bg-card text-sm text-fight" aria-hidden>
          Sealed
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">Passcode required</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Unlock {PRODUCT}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Reading cases is open. Running an analysis and sending responses to PayPal need the passcode. Judges: it is in the
          testing instructions.
        </p>
        <div className="mt-6">
          {unlockPossible() ? (
            <UnlockForm />
          ) : (
            <p role="alert" className="rounded-md border border-fight bg-paper p-3 text-sm text-fight">
              This deployment has no passcode set, so analyses, sending and the store tools stay off. Set APP_PASSCODE on the host.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
