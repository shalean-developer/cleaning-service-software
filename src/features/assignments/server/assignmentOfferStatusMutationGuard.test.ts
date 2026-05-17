import { describe, expect, it } from "vitest";
import {
  scanMigrationsForPatterns,
  scanSrcForPatterns,
} from "@/tests/security/staticGuardSupport";

/**
 * Command backends orchestrate offer status via updateOffer.
 * expireOffers.ts is the documented cron exception (offered → expired before command follow-up).
 */
const ALLOWED_OFFER_STATUS_WRITE_SRC = new Set([
  "features/bookings/server/commands/inMemoryBookingCommandBackend.ts",
  "features/bookings/server/commands/supabaseBookingCommandBackend.ts",
  "features/assignments/server/expireOffers.ts",
  "tests/security/rlsTestSupport.ts",
]);

const ALLOWED_OFFER_STATUS_WRITE_SQL = new Set([
  "20260517300000_assignment_offer_one_open_per_booking.sql",
]);

const OFFER_STATUS_UPDATE_PATTERNS = [
  /\.from\(\s*["']assignment_offers["']\s*\)[\s\S]*?\.update\(\s*\{[^}]*\bstatus\b/,
  /\.from\(\s*["']assignment_offers["']\s*\)[\s\S]*?\.update\(\s*\{[^}]*status:/,
];

const SQL_OFFER_STATUS_UPDATE = [
  /update\s+public\.assignment_offers[\s\S]*?\bstatus\s*=/i,
];

describe("assignment offer status mutation guard (static)", () => {
  it("does not patch assignment_offers.status outside approved adapters", () => {
    const violations = scanSrcForPatterns({
      allowedRelPaths: ALLOWED_OFFER_STATUS_WRITE_SRC,
      patterns: OFFER_STATUS_UPDATE_PATTERNS,
    });
    expect(violations).toEqual([]);
  });

  it("does not add new SQL migrations that UPDATE assignment_offers.status", () => {
    const violations = scanMigrationsForPatterns({
      allowedRelPaths: ALLOWED_OFFER_STATUS_WRITE_SQL,
      patterns: SQL_OFFER_STATUS_UPDATE,
    });
    expect(violations).toEqual([]);
  });
});
