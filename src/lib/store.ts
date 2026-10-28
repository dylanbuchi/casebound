import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

// Tiny JSON file store. One instance, one merchant: enough for a sandbox demo.
// lean-ctx: single-process JSON files, upgrade to a database when there is more than one instance.

const locks = new Map<string, Promise<unknown>>();

function file(name: string) {
  return path.join(process.cwd(), env.dataDir, `${name}.json`);
}

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file(name), "utf8")) as T;
  } catch {
    return fallback;
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
