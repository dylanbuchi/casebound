import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { runSteps } = await import("./run-steps");
const { PayPalError } = await import("./paypal/client");

const step = { label: "Send a message", action: { kind: "send_message" as const, message: "Hi" } };

describe("runSteps", () => {
  it("reports success when PayPal accepted the step even if the log write fails", async () => {
    const act = vi.fn().mockResolvedValue({ ok: 1 });
    const log = vi.fn().mockRejectedValue(new Error("disk full"));
    const res = await runSteps({ act }, "PP-D-1", "demo", [step], "seed", log);
    expect(res.ok).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });

  it("reports a rejection only when PayPal rejected it, and stops there", async () => {
    const act = vi.fn().mockRejectedValue(new PayPalError("Bad request", 400));
    const log = vi.fn().mockResolvedValue(undefined);
    const res = await runSteps({ act }, "PP-D-1", "demo", [step, step], "seed", log);
    expect(res).toEqual({ ok: false, message: 'PayPal rejected "Send a message": Bad request' });
    expect(act).toHaveBeenCalledTimes(1);
  });
});
