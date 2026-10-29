import { describe, expect, it, vi } from "vitest";

const claimAnalysisSlot = vi.fn();
vi.mock("@/lib/auth", () => ({ isUnlocked: async () => true }));
vi.mock("@/lib/env", () => ({ env: { anthropicConfigured: true } }));
vi.mock("@/lib/agent", () => ({ analyzeDispute: vi.fn() }));
vi.mock("@/lib/source", () => ({ source: vi.fn() }));
vi.mock("@/lib/records", () => ({ claimAnalysisSlot, saveAnalysis: vi.fn() }));

const { POST } = await import("./route");

const call = (id: string, ip: string) =>
  POST(new Request("http://x/api/analyze/" + id, { method: "POST", headers: { "cf-connecting-ip": ip } }), {
    params: Promise.resolve({ id }),
  } as never);

describe("POST /api/analyze/[id]", () => {
  it("frees the slots when the usage count cannot be saved", async () => {
    claimAnalysisSlot.mockRejectedValue(new Error("disk full"));
    // More failures than there are concurrency slots, on the same dispute, from different networks.
    for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) expect((await call("PP-D-1", ip)).status).toBe(503);
    claimAnalysisSlot.mockResolvedValue({ ok: false, used: 25, cap: 25 });
    expect((await call("PP-D-1", "4.4.4.4")).status).toBe(429);
    expect(await (await call("PP-D-1", "5.5.5.5")).json()).toEqual({ error: expect.stringContaining("Today's limit") });
  });
});
