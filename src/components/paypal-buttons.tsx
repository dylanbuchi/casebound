"use client";

import { useEffect, useRef, useState } from "react";

type PayPalNamespace = {
  Buttons: (opts: {
    style?: Record<string, string>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onError?: (err: unknown) => void;
  }) => { render: (el: HTMLElement) => Promise<void>; close?: () => Promise<void> };
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

// One SDK load shared by every button on the page.
let sdk: Promise<PayPalNamespace> | null = null;
function loadPayPal(clientId: string) {
  sdk ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    s.async = true;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK missing")));
    s.onerror = () => {
      sdk = null;
      reject(new Error("Could not load PayPal"));
    };
    document.head.appendChild(s);
  });
  return sdk;
}

// PayPal JS SDK checkout for one product. The server creates and captures the order.
export function PayPalButtons({ clientId, sku }: { clientId: string; sku: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean | null; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPayPal(clientId).then(
      () => !cancelled && setReady(true),
      () => !cancelled && setMsg({ ok: false, text: "Could not load PayPal checkout." }),
    );
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!ready || !ref.current || !window.paypal) return;
    const el = ref.current;
    const buttons = window.paypal.Buttons({
      style: { layout: "horizontal", color: "black", shape: "rect", label: "pay", tagline: "false" },
      async createOrder() {
        const res = await fetch("/api/store/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sku }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not start checkout");
        return body.id as string;
      },
      async onApprove({ orderID }) {
        // Approval alone does not move money; the capture below does, so ask the buyer to wait for it.
        setMsg({ ok: null, text: "Confirming your payment. Keep this tab open…" });
        const res = await fetch(`/api/store/orders/${encodeURIComponent(orderID)}/capture`, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        setMsg(
          res.ok
            ? { ok: true, text: `Payment confirmed (order ${body.orderId}). You can leave this page.` }
            : { ok: false, text: body.error ?? "Payment failed. You have not been charged." },
        );
      },
      onError: () => setMsg({ ok: false, text: "PayPal checkout failed. Try again." }),
    });
    buttons.render(el).catch(() => undefined);
    return () => {
      buttons.close?.().catch(() => undefined);
      el.replaceChildren();
    };
  }, [ready, sku]);

  return (
    <div>
      {!ready && !msg && <div className="skeleton h-[45px] w-full" role="status" aria-label="Loading PayPal checkout" />}
      <div ref={ref} className={ready ? "min-h-[45px]" : ""} />
      {msg && (
        <p role="status" className={`mt-2 flex items-center gap-2 text-sm ${msg.ok === null ? "text-offer" : msg.ok ? "font-medium text-accept" : "text-fight"}`}>
          {msg.ok === null && <span className="spinner" aria-hidden />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
