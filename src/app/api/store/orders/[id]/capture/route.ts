import { isUnlocked } from "@/lib/auth";
import { isLive } from "@/lib/env";
import { upsertFulfillment } from "@/lib/fulfillment";
import { PayPalError } from "@/lib/paypal/client";
import { getOrder } from "@/lib/paypal/disputes";
import { captureOrder } from "@/lib/paypal/shop";

export async function POST(_req: Request, ctx: RouteContext<"/api/store/orders/[id]/capture">) {
  const { id } = await ctx.params;
  if (!isLive()) return Response.json({ error: "The demo store needs PayPal sandbox credentials." }, { status: 503 });
  if (!(await isUnlocked())) return Response.json({ error: "Enter the passcode first." }, { status: 401 });
  if (!/^[A-Z0-9]{8,32}$/.test(id)) return Response.json({ error: "Invalid order id" }, { status: 400 });

  try {
    const order = await captureOrder(id);
    const unit = order.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    if (!capture) return Response.json({ error: "Payment was not captured" }, { status: 502 });

    // The capture response omits line items, so read them from the order itself.
    const full = await getOrder(order.id).catch(() => null);
    const items = full?.purchase_units?.[0]?.items ?? unit.items ?? [];
    const addr = unit.shipping?.address;
    await upsertFulfillment({
      orderId: order.id,
      captureId: capture.id,
      createdAt: new Date().toISOString(),
      buyerName: [order.payer?.name?.given_name, order.payer?.name?.surname].filter(Boolean).join(" ") || "Buyer",
      buyerEmail: order.payer?.email_address ?? "unknown",
      shipTo: [addr?.admin_area_2, addr?.country_code].filter(Boolean).join(", ") || "Unknown",
      items: items.map((i) => ({ name: i.name, quantity: Number(i.quantity), unitPrice: i.unit_amount?.value ?? "0" })),
      total: capture.amount.value,
    });
    return Response.json({ orderId: order.id, captureId: capture.id, status: capture.status });
  } catch (e) {
    console.error("capture failed", e);
    return Response.json({ error: e instanceof PayPalError ? e.message : "Could not capture payment" }, { status: 502 });
  }
}
