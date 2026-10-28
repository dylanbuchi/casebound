import { BackToInbox } from "@/components/states";

export default function NotFound() {
  return (
    <div className="rise mx-auto max-w-xl py-12 text-center">
      <span className="stamp text-xl text-ink-3" aria-hidden>
        No file
      </span>
      <h1 className="mt-6 font-display text-4xl font-semibold">There is no case by that name.</h1>
      <p className="mt-3 text-ink-2">The link may be mistyped, or the dispute belongs to another PayPal account.</p>
      <div className="mt-6">
        <BackToInbox />
      </div>
    </div>
  );
}
