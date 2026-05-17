import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "../../../../../src");

/** Paths allowed to reference booking status writes (RPC layer or test backends). */
const ALLOWED_STATUS_WRITE_FILES = new Set([
  "features/bookings/server/commands/inMemoryBookingCommandBackend.ts",
  "features/bookings/server/commands/supabaseBookingCommandBackend.ts",
  "features/bookings/server/directMutationGuard.ts",
  "tests/security/rlsTestSupport.ts",
]);

const FORBIDDEN_PATTERNS = [
  /\.from\(\s*["']bookings["']\s*\)[\s\S]*?\.update\(\s*\{[^}]*\bstatus\b/,
  /\.from\(\s*["']bookings["']\s*\)[\s\S]*?\.update\(\s*\{[^}]*status:/,
];

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      collectTsFiles(full, acc);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("booking status mutation guard (static)", () => {
  it("does not patch bookings.status from the app layer outside approved adapters", () => {
    const violations: string[] = [];

    for (const file of collectTsFiles(SRC_ROOT)) {
      const rel = path.relative(SRC_ROOT, file).replaceAll("\\", "/");
      if (ALLOWED_STATUS_WRITE_FILES.has(rel)) continue;
      if (rel.endsWith(".test.ts")) continue;

      const content = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(rel);
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
