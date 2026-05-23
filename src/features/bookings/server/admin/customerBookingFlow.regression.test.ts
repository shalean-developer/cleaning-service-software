import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

const CUSTOMER_ROUTE_FILES = [
  "src/app/api/bookings/lock/route.ts",
  "src/app/api/paystack/initialize/route.ts",
  "src/app/api/paystack/webhook/route.ts",
  "src/app/api/paystack/verify/route.ts",
];

const ADMIN_ASSIST_MARKERS = [
  /\badminAssisted\b/,
  /\badmin_assisted\b/,
  /\badminAssist\b/,
  /\bADMIN_ASSISTED_/,
  /\badminCreateBookingDraftFacade\b/,
  /\badminRecordOfflinePaymentFacade\b/,
];

describe("customer booking flow regression (static)", () => {
  for (const rel of CUSTOMER_ROUTE_FILES) {
    it(`${path.basename(rel)} does not import admin-assisted booking code`, () => {
      const source = readFileSync(path.join(root, rel), "utf8");
      for (const pattern of ADMIN_ASSIST_MARKERS) {
        expect(source).not.toMatch(pattern);
      }
    });
  }

  it("customer book page route remains present", () => {
    const pagePath = path.join(root, "src/app/(customer)/customer/book/page.tsx");
    const source = readFileSync(pagePath, "utf8");
    expect(source.length).toBeGreaterThan(0);
  });

  it("bookings lock route still uses canonical lock facade", () => {
    const source = readFileSync(path.join(root, CUSTOMER_ROUTE_FILES[0]), "utf8");
    expect(source).toMatch(/lock/i);
    expect(source).not.toMatch(/\bstatus:\s*["']confirmed["']/);
  });

  it("paystack initialize route does not write confirmed status directly", () => {
    const source = readFileSync(path.join(root, CUSTOMER_ROUTE_FILES[1]), "utf8");
    expect(source).not.toMatch(/\.update\(\s*\{[^}]*status:\s*["']confirmed["']/);
  });
});
