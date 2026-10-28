// Passcode rules without Next.js imports, so they can be tested directly.

export type PassConfig = { passcode: string; production: boolean };

// Production always needs a passcode. Without one set there, nothing can unlock: fail closed.
export const passcodeRequired = (c: PassConfig) => c.production || Boolean(c.passcode);
export const unlockPossible = (c: PassConfig) => Boolean(c.passcode);
