import { describe, expect, it } from "vitest";
import { passcodeRequired, unlockPossible } from "./pass";

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
