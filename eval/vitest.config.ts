import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Offline eval: real agent pipeline, synthetic disputes, real model calls. Run with `pnpm eval`.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the shell environment.
}

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./server-only-stub.ts", import.meta.url)),
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  test: {
    include: ["eval/**/*.eval.ts"],
    testTimeout: 30 * 60_000,
    env: { AI_MODEL: process.env.AI_MODEL || "claude-haiku-5-5" },
  },
});
