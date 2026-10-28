// Dev tool: captures README/Devpost screenshots of the running app.
// Usage: node scripts/screenshots.mjs [baseUrl]   (default http://localhost:3217)
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3217";
const out = "docs/screenshots";

// Unlock with the same cookie the app sets, derived from APP_PASSCODE in .env.local.
const env = await readFile(".env.local", "utf8").catch(() => "");
const passcode = env.match(/^APP_PASSCODE=(.*)$/m)?.[1] ?? "";
const cookie = createHash("sha256").update(`dispute-desk:${passcode}`).digest("hex");

const shots = [
  { name: "1-inbox", path: "/", fullPage: false },
  { name: "2-verdict-fight", path: "/disputes/PP-R-ZIV-10194962", fullPage: false },
  { name: "3-send-and-receipt", path: "/disputes/PP-R-ZIV-10194962", crop: ["form[aria-label='Review and send']", "section[aria-label='Receipts']"] },
  { name: "4-offer-resolved", path: "/disputes/PP-R-GDD-10194963", fullPage: false },
  { name: "5-demo-store", path: "/store", fullPage: false },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
if (passcode) await context.addCookies([{ name: "dd_pass", value: cookie, url: base }]);
const page = await context.newPage();

for (const s of shots) {
  await page.goto(base + s.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if (s.crop) {
    // Tight crop around the given elements, with a margin.
    const boxes = await Promise.all(s.crop.map((sel) => page.locator(sel).boundingBox()));
    const top = Math.min(...boxes.map((b) => b.y)) - 24;
    const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 24;
    const left = Math.min(...boxes.map((b) => b.x)) - 24;
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + 24;
    await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: true, clip: { x: left, y: top, width: right - left, height: bottom - top } });
  } else {
    await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: Boolean(s.fullPage) });
  }
  console.log("saved", `${out}/${s.name}.png`);
}
await browser.close();
