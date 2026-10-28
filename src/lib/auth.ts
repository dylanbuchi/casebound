import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// One shared passcode guards everything that spends money or changes a dispute.
// Without APP_PASSCODE set, the app is open (local development only).

export const PASS_COOKIE = "dd_pass";

const digest = (s: string) => createHash("sha256").update(`dispute-desk:${s}`).digest();

export const passcodeRequired = () => Boolean(env.appPasscode);

export function checkPasscode(input: string) {
  if (!env.appPasscode) return true;
  return timingSafeEqual(digest(input), digest(env.appPasscode));
}

export const cookieValue = () => digest(env.appPasscode).toString("hex");

export async function isUnlocked() {
  if (!env.appPasscode) return true;
  const c = (await cookies()).get(PASS_COOKIE)?.value ?? "";
  const expected = cookieValue();
  return c.length === expected.length && timingSafeEqual(Buffer.from(c), Buffer.from(expected));
}
