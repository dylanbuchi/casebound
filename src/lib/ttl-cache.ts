// Tiny in-memory cache for PayPal GET reads. Keeps repeat page views and refresh loops from fanning out to PayPal.
export function createTtlCache<T>(ttlMs: number, now: () => number = Date.now) {
  const entries = new Map<string, { value: T; expiresAt: number }>();
  return {
    get(key: string): T | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T) {
      entries.set(key, { value, expiresAt: now() + ttlMs });
    },
    clear() {
      entries.clear();
    },
  };
}
