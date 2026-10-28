import { UnlockForm } from "@/components/unlock-form";
import { PRODUCT } from "@/lib/brand";

export default function Unlock() {
  return (
    <div className="mx-auto max-w-sm space-y-4 py-10">
      <h1 className="font-display text-3xl font-semibold">Unlock {PRODUCT}</h1>
      <p className="text-sm text-ink-2">
        Running analyses and sending responses needs the passcode. Judges: it is in the testing instructions.
      </p>
      <UnlockForm />
    </div>
  );
}
