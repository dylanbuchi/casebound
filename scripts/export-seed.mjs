// Dev tool: snapshots the live demo's JSON records into seed/ so a fresh deploy boots
// with the same shop orders, saved analyses and receipts. Refuses anything secret-looking.
// Usage: node scripts/export-seed.mjs [dataDir]   (default .data)
import { mkdir, readFile, writeFile } from "node:fs/promises";

const dataDir = process.argv[2] ?? ".data";
const names = ["fulfillment", "analyses", "audit"];
const forbidden = /(client_secret|access_token|ANTHROPIC|sk-ant-|APP_PASSCODE|Bearer )/i;

await mkdir("seed", { recursive: true });
for (const name of names) {
  const text = await readFile(`${dataDir}/${name}.json`, "utf8").catch(() => null);
  if (text === null) {
    console.log("skip", name, "(no data)");
    continue;
  }
  if (forbidden.test(text)) throw new Error(`${name}.json looks like it contains a secret; not exported`);
  await writeFile(`seed/${name}.json`, JSON.stringify(JSON.parse(text), null, 2) + "\n");
  console.log("exported", name);
}
