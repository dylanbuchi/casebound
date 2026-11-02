import { describe, expect, it } from "vitest";
import { createTtlCache } from "./ttl-cache";

describe("createTtlCache", () => {
  it("misses, hits, then expires", () => {
    let t = 1000;
    const c = createTtlCache<string>(30_000, () => t);
    expect(c.get("a")).toBeUndefined();
    c.set("a", "x");
    expect(c.get("a")).toBe("x");
    t += 29_999;
    expect(c.get("a")).toBe("x");
    t += 1;
    expect(c.get("a")).toBeUndefined();
  });

  it("clear drops everything", () => {
    const c = createTtlCache<number>(1000);
    c.set("a", 1);
    c.clear();
    expect(c.get("a")).toBeUndefined();
  });
});
