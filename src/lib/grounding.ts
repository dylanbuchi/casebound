import type { Assessment } from "@/lib/agent";
import type { CheckItem } from "@/lib/checklist";
import type { FulfillmentRecord } from "@/lib/fulfillment";
import type { Tracker } from "@/lib/paypal/types";

// Code-side guard on what the agent writes: every delivery, signature and reference-number claim must be
// backed by the source it names. The prompt asks for this too, but the check below is what enforces it.

export type Facts = { trackers: Tracker[]; record: FulfillmentRecord | null; ids?: string[] };
export type Unsupported = { where: string; text: string; reason: string };

const CARRIER = /\b(carrier|usps|ups|fedex|dhl|royal mail|tracking|tracker)\b|\bpaypal (?:shows|confirms|tracking)\b/i;
const SHOP = /\b(our|shop|store)(?:'s)? (?:own )?(?:fulfillment |shipping )?(?:record|records|log|notes)\b/i;
const DELIVERED = /\b(delivered|delivery (?:was |is )?confirmed|confirm(?:s|ed) delivery|delivery scan|proof of delivery)\b/i;
const SIGNED = /\b(signed|signature)\b/i;
const HEDGED =
  /\b(not|never|without|unverified|unconfirmed|pending|yet to|isn't|hasn't|doesn't|wasn't|didn't|cannot|can't|unable|claims?|claimed|alleges?|whether|if|verify)\b|\bno (?:delivery|signature|scan|tracking|record|confirmation|proof)\b/i;

const norm = (s: string) => s.replace(/\s+/g, "").toUpperCase();
const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter((x) => x.trim());

function knownNumbers({ trackers, record, ids = [] }: Facts) {
  return new Set(
    [
      ...trackers.map((t) => t.tracking_number),
      record?.trackingNumber,
      record?.captureId,
      record?.orderId,
      ...(record?.refunds ?? []).map((r) => r.refundId),
      ...ids,
    ]
      .filter((x): x is string => Boolean(x))
      .map(norm),
  );
}

// Why a sentence claims more than the records support, or null when it is fine.
export function problemWith(sentence: string, facts: Facts, opts: { carrierSource?: boolean } = {}): string | null {
  const known = knownNumbers(facts);
  const numbers = [...(sentence.match(/\b\d[\d ]{8,}\d\b/g) ?? []), ...(sentence.match(/\b[A-Z0-9]{10,}\b/g) ?? [])]
    .map(norm)
    .filter((n) => n.length >= 10 && (n.match(/\d/g)?.length ?? 0) >= 6);
  // A digit run inside a known ID (such as the number in PP-D-123456789012) is that ID, not a new one.
  const unknown = numbers.find((n) => !known.has(n) && ![...known].some((k) => k.includes(n)));
  if (unknown) return `Reference number ${unknown} is not in PayPal or the shop record`;
  if (HEDGED.test(sentence)) return null;

  const carrierDelivered = facts.trackers.some((t) => t.status === "DELIVERED");
  const toCarrier = opts.carrierSource || (CARRIER.test(sentence) && !SHOP.test(sentence));
  if (SIGNED.test(sentence)) {
    if (!facts.record?.signedBy) return "No signature is on file";
    if (toCarrier) return "The signature comes from the shop record, not the carrier";
  }
  if (DELIVERED.test(sentence)) {
    if (toCarrier && !carrierDelivered) {
      const status = facts.trackers.find((t) => t.status)?.status;
      return `PayPal tracking ${status ? `shows ${status}` : "has no delivery scan"}, so the carrier has not confirmed delivery`;
    }
    if (!carrierDelivered && !facts.record?.deliveredAt) return "No delivery is on file";
  }
  return null;
}

const TEXT_FIELDS = ["summary", "win_probability_reasoning", "action_reasoning", "evidence_notes", "buyer_message"] as const;

export function findUnsupported(a: Assessment, facts: Facts): Unsupported[] {
  const out: Unsupported[] = [];
  for (const field of TEXT_FIELDS) {
    for (const text of sentences(a[field])) {
      const reason = problemWith(text, facts);
      if (reason) out.push({ where: field, text, reason });
    }
  }
  a.key_facts.forEach((f, i) => {
    const reason = problemWith(f.fact, facts, { carrierSource: f.source === "paypal_tracking" });
    if (reason) out.push({ where: `key_facts[${i}]`, text: f.fact, reason });
  });
  return out;
}

// Drops whatever is still unsupported, so it can never reach PayPal or the buyer, and says what went.
export function enforceGrounding(a: Assessment, facts: Facts): { assessment: Assessment; removed: Unsupported[] } {
  const removed = findUnsupported(a, facts);
  if (removed.length === 0) return { assessment: a, removed };
  const drop = new Set(removed.map((r) => `${r.where}\u0000${r.text}`));
  const next = { ...a, key_facts: a.key_facts.filter((f, i) => !drop.has(`key_facts[${i}]\u0000${f.fact}`)) };
  for (const field of TEXT_FIELDS) {
    next[field] = sentences(a[field])
      .filter((s) => !drop.has(`${field}\u0000${s}`))
      .join(" ");
  }
  return { assessment: next, removed };
}

// The model's win estimate, capped by how much of the seller's case rests on independent evidence.
export type Calibration = {
  modelEstimate: number;
  calibrated: number;
  cap: number;
  basis: { label: string; source: CheckItem["source"]; effect: number; why: string }[];
};

const CEILING = 0.9;
const FLOOR = 0.05;

export function calibrate(p: number, checklist: CheckItem[]): Calibration {
  const basis = checklist
    .filter((c) => c.source !== "Dispute")
    .map((c) => {
      const [effect, why] =
        c.status === "missing"
          ? [0.15, "missing"]
          : c.status === "weak"
            ? [0.1, "weak or unverified"]
            : c.source === "PayPal"
              ? [0, "confirmed by PayPal"]
              : [0.05, "your own record, not independently confirmed"];
      return c.conflict
        ? { label: c.label, source: c.source, effect: effect + 0.1, why: "contradicted by PayPal tracking" }
        : { label: c.label, source: c.source, effect, why };
    });
  const cap = Math.max(FLOOR, Math.round((CEILING - basis.reduce((s, b) => s + b.effect, 0)) * 100) / 100);
  const estimate = Math.min(1, Math.max(0, p));
  return { modelEstimate: estimate, calibrated: Math.min(estimate, cap), cap, basis };
}
