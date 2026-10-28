import { createHmac, timingSafeEqual } from "node:crypto";
// Passcode rules without Next.js imports, so they can be tested directly.

export type PassConfig = { passcode: string; production: boolean };

// Production always needs a passcode. Without one set there, nothing can unlock: fail closed.
export const passcodeRequired = (c: PassConfig) => c.production || Boolean(c.passcode);
export const unlockPossible = (c: PassConfig) => Boolean(c.passcode);

// The unlock cookie: an expiry time plus an HMAC over it. The key comes from AUTH_SECRET (or the passcode
// when that is unset), so changing either one revokes every cookie. Expiry is checked here, not by the browser.
export const COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Signer = { passcode: string; secret: string };

const mac = (s: Signer, exp: number) =>
  createHmac("sha256", s.secret || `passcode:${s.passcode}`).update(`dispute-desk:${s.passcode}:${exp}`).digest("hex");

export const makeToken = (s: Signer, now: number) => {
  const exp = now + COOKIE_TTL_MS;
  return `${exp}.${mac(s, exp)}`;
};

export function verifyToken(s: Signer, token: string, now: number) {
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(token);
  if (!m || !s.passcode) return false;
  const exp = Number(m[1]);
  if (exp <= now || exp > now + COOKIE_TTL_MS) return false;
  return timingSafeEqual(Buffer.from(m[2]), Buffer.from(mac(s, exp)));
}
