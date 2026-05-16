import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/** Load .env / .env.local so integration gates see vars from untracked local files. */
function applyLocalEnv(): void {
  const envDir = process.cwd();
  for (const mode of ["test", "development", "production"] as const) {
    const loaded = loadEnv(mode, envDir, "");
    for (const [key, value] of Object.entries(loaded)) {
      if (process.env[key] === undefined && typeof value === "string") {
        process.env[key] = value;
      }
    }
  }
}

applyLocalEnv();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
