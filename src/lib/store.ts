import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, isLive } from "@/lib/env";

// Tiny JSON file store. One instance, one merchant: enough for a sandbox demo.
// lean-ctx: single-process JSON files, upgrade to a database when there is more than one instance.

const locks = new Map<string, Promise<unknown>>();

function file(name: string) {
  return path.join(process.cwd(), env.dataDir, `${name}.json`);
}

// Committed, secret-free starting state for the hosted demo. Hosts with ephemeral disks
// (Render free tier) wipe DATA_DIR on restart; reads then fall back to the seed, and the
// first write copies seed plus change into DATA_DIR. PayPal stays the source of truth for disputes.
const SEEDED = new Set(["fulfillment", "analyses", "audit"]);

function seedFile(name: string) {
  return path.join(process.cwd(), "seed", `${name}.json`);
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file(name), "utf8")) as T;
  } catch {
    if (!isLive() || !SEEDED.has(name)) return fallback;
    try {
      return JSON.parse(await readFile(seedFile(name), "utf8")) as T;
    } catch {
      return fallback;
    }
  }
}

// Serializes read-modify-write per file so concurrent requests do not drop updates.
export function updateJson<T>(name: string, fallback: T, fn: (current: T) => T): Promise<T> {
  const prev = locks.get(name) ?? Promise.resolve();
  const next = prev.then(async () => {
    const updated = fn(await readJson(name, fallback));
    const target = file(name);
    await mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(updated, null, 2));
    await rename(tmp, target);
    return updated;
  });
  locks.set(name, next.catch(() => undefined));
  return next;
}
