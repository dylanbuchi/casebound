import { findProduct } from "@/lib/catalog";
import { isLive } from "@/lib/env";
import { PayPalError } from "@/lib/paypal/client";
import { createOrder } from "@/lib/paypal/shop";

export async function POST(req: Request) {
  if (!isLive()) return Response.json({ error: "The demo store needs PayPal sandbox credentials." }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { sku?: unknown };
  const product = typeof body.sku === "string" ? findProduct(body.sku) : undefined;
  if (!product) return Response.json({ error: "Unknown product" }, { status: 400 });
  try {
    const order = await createOrder(product);
    return Response.json({ id: order.id });
  } catch (e) {
    console.error("create order failed", e);
    return Response.json({ error: e instanceof PayPalError ? e.message : "Could not create order" }, { status: 502 });
  }
}
