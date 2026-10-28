import "server-only";
import { randomUUID } from "node:crypto";
import { paypal } from "./client";
import type { OrderSummary } from "./types";

// Orders v2 + Shipment Tracking calls used by the demo store to create real sandbox payments.

export function createOrder(item: { sku: string; name: string; price: string }) {
  return paypal<{ id: string; status: string }>("/v2/checkout/orders", {
    method: "POST",
    requestId: randomUUID(),
    json: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: item.sku,
          description: item.name,
          amount: {
            currency_code: "USD",
            value: item.price,
            breakdown: { item_total: { currency_code: "USD", value: item.price } },
          },
          items: [{ name: item.name, sku: item.sku, quantity: "1", unit_amount: { currency_code: "USD", value: item.price } }],
        },
      ],
      payment_source: {
        paypal: {
          experience_context: { shipping_preference: "GET_FROM_FILE", user_action: "PAY_NOW", brand_name: "Lumen & Loom" },
        },
      },
    },
  });
}

export type CapturedOrder = OrderSummary & {
  purchase_units: (NonNullable<OrderSummary["purchase_units"]>[number] & {
    payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] };
  })[];
};

export const captureOrder = (orderId: string) =>
  paypal<CapturedOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    json: {},
    requestId: `capture-${orderId}`,
  });

// Orders v2 tracking: works with the standard orders scope (the v1 Tracking API needs a separate permission).
export function addTracker(t: { orderId: string; captureId: string; trackingNumber: string; carrier: string; carrierOther?: string }) {
  return paypal(`/v2/checkout/orders/${encodeURIComponent(t.orderId)}/track`, {
    method: "POST",
    requestId: `track-${t.captureId}-${t.trackingNumber}`,
    json: {
      capture_id: t.captureId,
      tracking_number: t.trackingNumber,
      carrier: t.carrier,
      ...(t.carrier === "OTHER" ? { carrier_name_other: t.carrierOther } : {}),
      notify_payer: false,
    },
  });
}
