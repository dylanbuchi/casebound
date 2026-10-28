import { describe, expect, it } from "vitest";
import { clientIp, concurrencyGate, rateLimiter } from "./limits";

describe("rateLimiter", () => {
  it("allows max hits per window per key, then says how long to wait", () => {
    let t = 0;
    const rl = rateLimiter(2, 1000, () => t);
    expect(rl.take("a").ok).toBe(true);
    t = 100;
    expect(rl.take("a").ok).toBe(true);
    expect(rl.take("a")).toEqual({ ok: false, retryMs: 900 });
    expect(rl.take("b").ok).toBe(true);
    t = 1000;
    expect(rl.take("a").ok).toBe(true);
  });
});

describe("concurrencyGate", () => {
  it("lets at most max jobs in at once", () => {
    const g = concurrencyGate(2);
    expect(g.tryEnter()).toBe(true);
    expect(g.tryEnter()).toBe(true);
    expect(g.tryEnter()).toBe(false);
    g.leave();
    expect(g.tryEnter()).toBe(true);
    expect(g.active).toBe(2);
  });
});

describe("clientIp", () => {
  it("reads the first forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers())).toBe("local");
  });
});
