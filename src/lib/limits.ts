// In-memory limits for one server process. They reset when the process restarts, so they slow abuse
// down rather than cap spend: the hard backstop is the spend limit set in the Anthropic console.

// At most `max` hits per key in any `windowMs`; returns how long to wait when over.
export function rateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    take(key: string): { ok: true } | { ok: false; retryMs: number } {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return { ok: false, retryMs: windowMs - (t - recent[0]) };
      }
      recent.push(t);
      hits.set(key, recent);
      // Drop idle keys now and then so the map cannot grow without bound.
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
      return { ok: true };
    },
  };
}

// At most `max` jobs at once across all keys.
export function concurrencyGate(max: number) {
  let active = 0;
  return {
    tryEnter: () => (active < max ? (active++, true) : false),
    leave: () => {
      active = Math.max(0, active - 1);
    },
    get active() {
      return active;
    },
  };
}

// The visitor's address, read only from headers the client cannot pick freely. Render serves through
// Cloudflare (responses carry cf-ray), which overwrites CF-Connecting-IP with the real client address.
// Without it, take the right-most X-Forwarded-For entry, the one added by the nearest proxy; the
// left-most entries are whatever the client sent.
export function clientIp(headers: Headers) {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return xff?.at(-1) || headers.get("x-real-ip") || "local";
}
