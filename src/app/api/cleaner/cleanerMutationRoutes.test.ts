import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectPostRoutes } from "@/tests/security/staticGuardSupport";

/** Cleaner POST mutation routes (intentional). */
const ALLOWED_CLEANER_POST_ROUTES = new Set([
  "offers/[offerId]/accept/route.ts",
  "offers/[offerId]/decline/route.ts",
  "jobs/[bookingId]/start/route.ts",
  "jobs/[bookingId]/complete/route.ts",
]);

describe("cleaner mutation API routes", () => {
  it("only exposes intentional cleaner POST mutation routes", () => {
    const cleanerApiDir = path.join(process.cwd(), "src/app/api/cleaner");
    const postRoutes = collectPostRoutes(cleanerApiDir);

    expect(postRoutes.sort()).toEqual([...ALLOWED_CLEANER_POST_ROUTES].sort());
  });
});
