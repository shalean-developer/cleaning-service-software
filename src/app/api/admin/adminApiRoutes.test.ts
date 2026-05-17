import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Intentional admin POST mutation routes. */
const ALLOWED_ADMIN_POST_ROUTES = new Set([
  "bookings/[bookingId]/payout-ready/route.ts",
  "bookings/[bookingId]/mark-paid-out/route.ts",
  "bookings/[bookingId]/recover-assignment/route.ts",
  "bookings/[bookingId]/dispatch-offer/route.ts",
  "bookings/[bookingId]/replace-open-offer/route.ts",
]);

function collectRouteFiles(dir: string, prefix = ""): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(full).isDirectory()) {
      files.push(...collectRouteFiles(full, rel));
    } else if (name === "route.ts") {
      files.push(rel);
    }
  }
  return files;
}

describe("admin API routes", () => {
  it("only exposes intentional admin POST mutation routes", () => {
    const adminApiDir = path.join(process.cwd(), "src/app/api/admin");
    const routeFiles = collectRouteFiles(adminApiDir);
    const postRoutes: string[] = [];

    for (const rel of routeFiles) {
      const content = readFileSync(path.join(adminApiDir, rel), "utf8");
      if (/export\s+async\s+function\s+POST/.test(content)) {
        postRoutes.push(rel.replace(/\\/g, "/"));
      }
    }

    expect(postRoutes.sort()).toEqual([...ALLOWED_ADMIN_POST_ROUTES].sort());
  });
});
