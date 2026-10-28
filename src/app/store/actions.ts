"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isUnlocked } from "@/lib/auth";
import { isLive } from "@/lib/env";
import { findFulfillment, patchFulfillment } from "@/lib/fulfillment";
import { PayPalError } from "@/lib/paypal/client";
import { createSandboxDispute } from "@/lib/paypal/sandbox";
import { addTracker } from "@/lib/paypal/shop";
import { carrierCode } from "@/lib/plan";

// Seller-side tools for staging realistic demo orders: ship with tracking, record delivery, add a note.

const Input = z.object({
  orderId: z.string().regex(/^[A-Z0-9]{8,32}$/),
  step: z.enum(["ship_tracked", "ship_untracked", "deliver", "deliver_signed", "note", "dispute_inr", "dispute_snad"]),
  carrier: z.string().max(40).optional(),
  note: z.string().max(300).optional(),
});

export type StoreActionState = { ok: boolean; message: string } | null;

export async function stageOrder(_prev: StoreActionState, form: FormData): Promise<StoreActionState> {
  if (!isLive()) return { ok: false, message: "Needs PayPal sandbox credentials." };
  if (!(await isUnlocked())) return { ok: false, message: "Enter the passcode first." };
  const parsed = Input.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const { orderId, step, note } = parsed.data;

  const record = await findFulfillment({ orderId });
  if (!record) return { ok: false, message: "Order not found." };
  const now = new Date().toISOString();

  try {
    switch (step) {
      case "ship_tracked": {
        const carrier = parsed.data.carrier || "USPS";
        // Sandbox-only fake tracking number in the carrier's usual length.
        const trackingNumber = `9400${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(0, 22);
        const code = carrierCode(carrier);
        await addTracker({ orderId, captureId: record.captureId, trackingNumber, carrier: code, carrierOther: carrier });
        await patchFulfillment(orderId, { carrier, trackingNumber, shippedAt: now });
        break;
      }
      case "ship_untracked":
        await patchFulfillment(orderId, {
          carrier: parsed.data.carrier || "Royal Mail",
          shippedAt: now,
          notes: [...(record.notes ?? []), "Sent without tracking to keep shipping cheap."],
        });
        break;
      case "deliver":
      case "deliver_signed":
        // Delivery comes from the carrier; the shop records it (PayPal has no seller-side "delivered" call here).
        await patchFulfillment(orderId, {
          deliveredAt: now,
          ...(step === "deliver_signed" ? { signedBy: record.buyerName.toUpperCase() } : { deliveryPhoto: true }),
        });
        break;
      case "dispute_inr":
      case "dispute_snad": {
        // Sandbox test tool: acts as the buyer opening a dispute on this payment.
        if (!record.buyerEmail.includes("@")) return { ok: false, message: "No buyer email on this order." };
        await createSandboxDispute({
          buyerEmail: record.buyerEmail,
          sellerTransactionId: record.captureId,
          reason: step === "dispute_inr" ? "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" : "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
          amount: { currency_code: "USD", value: record.total },
          message:
            note?.trim() ||
            (step === "dispute_inr" ? "My order never arrived. I want a refund." : "The item arrived damaged and is not as described."),
        });
        break;
      }
      case "note":
        if (note?.trim()) await patchFulfillment(orderId, { notes: [...(record.notes ?? []), note.trim()] });
        break;
    }
  } catch (e) {
    if (e instanceof PayPalError) {
      console.error("store action failed", step, e.status, e.debugId, JSON.stringify(e.details));
      const issue = Array.isArray(e.details) ? (e.details[0] as { issue?: string; description?: string } | undefined) : undefined;
      return { ok: false, message: `PayPal: ${e.message}${issue ? ` (${issue.issue}: ${issue.description})` : ""}` };
    }
    return { ok: false, message: "Something went wrong." };
  }
  revalidatePath("/store/orders");
  return { ok: true, message: "Updated." };
}
