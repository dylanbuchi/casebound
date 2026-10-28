import "server-only";
import { env } from "@/lib/env";

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly debugId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const basic = Buffer.from(`${env.paypalClientId}:${env.paypalClientSecret}`).toString("base64");
  const res = await fetch(`${env.paypalApiBase}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new PayPalError("PayPal authentication failed", res.status);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  json?: unknown;
  form?: FormData;
  query?: Record<string, string | undefined>;
  // Makes POST retries safe: PayPal dedupes requests that share an id.
  requestId?: string;
  headers?: Record<string, string>;
};

export async function paypal<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(path, env.paypalApiBase);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);

  const headers: Record<string, string> = { ...opts.headers, Authorization: `Bearer ${await accessToken()}` };
  if (opts.json !== undefined) headers["Content-Type"] = "application/json";
  if (opts.requestId) headers["PayPal-Request-Id"] = opts.requestId;

  const send = () =>
    fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.form ?? (opts.json !== undefined ? JSON.stringify(opts.json) : undefined),
      cache: "no-store",
    });
  // Reads retry once on transient failures; writes do not (a repeat could double-apply without a request id).
  const retryable = (opts.method ?? "GET") === "GET" || Boolean(opts.requestId);
  let res: Response;
  try {
    res = await send();
    if (retryable && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 400));
      res = await send();
    }
  } catch (e) {
    if (!retryable) throw e;
    await new Promise((r) => setTimeout(r, 400));
    res = await send();
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    // REST errors use message/name/debug_id; OAuth-style errors use error/error_description.
    const b = body as
      | { message?: string; name?: string; debug_id?: string; details?: unknown; error?: string; error_description?: string }
      | null;
    throw new PayPalError(
      b?.message ?? b?.error_description ?? b?.name ?? b?.error ?? `PayPal request failed (${res.status})`,
      res.status,
      b?.debug_id ?? res.headers.get("paypal-debug-id") ?? undefined,
      b?.details,
    );
  }
  return body as T;
}
