import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import * as pass from "@/lib/pass";

// One shared passcode guards everything that spends money or changes a dispute.
// Without APP_PASSCODE the app is open in local development, and fully locked in production.

export const PASS_COOKIE = "dd_pass";

const digest = (s: string) => createHash("sha256").update(`dispute-desk:${s}`).digest();
const config = () => ({ passcode: env.appPasscode, production: process.env.NODE_ENV === "production" });

export const passcodeRequired = () => pass.passcodeRequired(config());
export const unlockPossible = () => pass.unlockPossible(config());

export function checkPasscode(input: string) {
  if (!passcodeRequired()) return true;
  if (!unlockPossible()) return false;
  return timingSafeEqual(digest(input), digest(env.appPasscode));
}

export const cookieValue = () => digest(env.appPasscode).toString("hex");

export async function isUnlocked() {
  if (!passcodeRequired()) return true;
  if (!unlockPossible()) return false;
  const c = (await cookies()).get(PASS_COOKIE)?.value ?? "";
  const expected = cookieValue();
  return c.length === expected.length && timingSafeEqual(Buffer.from(c), Buffer.from(expected));
}
