import { describe, expect, it } from "vitest";
import { COOKIE_TTL_MS, makeToken, passcodeRequired, unlockPossible, verifyToken } from "./pass";

describe("passcode rules", () => {
  it("leaves local development open when no passcode is set", () => {
    expect(passcodeRequired({ passcode: "", production: false })).toBe(false);
  });

  it("locks production with no passcode, and nothing can unlock it", () => {
    const c = { passcode: "", production: true };
    expect(passcodeRequired(c)).toBe(true);
    expect(unlockPossible(c)).toBe(false);
  });

  it("requires the passcode wherever one is set", () => {
    expect(passcodeRequired({ passcode: "x", production: false })).toBe(true);
    expect(unlockPossible({ passcode: "x", production: true })).toBe(true);
  });
});

describe("unlock cookie", () => {
  const s = { passcode: "open-sesame", secret: "server-secret" };
  const t0 = 1_800_000_000_000;

  it("accepts a fresh token and rejects it after expiry", () => {
    const tok = makeToken(s, t0);
    expect(verifyToken(s, tok, t0 + 1000)).toBe(true);
    expect(verifyToken(s, tok, t0 + COOKIE_TTL_MS)).toBe(false);
  });

  it("is revoked by changing the secret or the passcode", () => {
    const tok = makeToken(s, t0);
    expect(verifyToken({ ...s, secret: "rotated" }, tok, t0)).toBe(false);
    expect(verifyToken({ ...s, passcode: "new" }, tok, t0)).toBe(false);
  });

  it("rejects a token whose expiry was pushed out or that is malformed", () => {
    const [, sig] = makeToken(s, t0).split(".");
    expect(verifyToken(s, `${t0 + COOKIE_TTL_MS * 2}.${sig}`, t0)).toBe(false);
    expect(verifyToken(s, "garbage", t0)).toBe(false);
    expect(verifyToken({ ...s, passcode: "" }, makeToken({ ...s, passcode: "" }, t0), t0)).toBe(false);
  });
});
