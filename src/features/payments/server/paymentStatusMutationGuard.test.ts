import { describe, expect, it } from "vitest";
import {
  scanMigrationsForPatterns,
  scanSrcForPatterns,
} from "@/tests/security/staticGuardSupport";

/**
 * Approved adapters for payments.status persistence.
 * Status transitions to paid/failed are RPC-only (see booking_command_layer migration).
 *
 * `tests/security/rlsTestSupport.ts` is allowed only for RLS integration probes
 * (e.g. isPaymentsRlsPhase1Applied) — not production payment lifecycle writes.
 */
const ALLOWED_PAYMENT_STATUS_WRITE_SRC = new Set([
  "features/bookings/server/commands/inMemoryBookingCommandBackend.ts",
  "features/bookings/server/commands/supabaseBookingCommandBackend.ts",
  "tests/security/rlsTestSupport.ts",
]);

/** Postgres RPCs that update payments.status (service_role only at runtime). */
const ALLOWED_PAYMENT_STATUS_WRITE_SQL = new Set([
  "20260515203000_booking_command_layer.sql",
]);

const PAYMENT_STATUS_UPDATE_PATTERNS = [
  /\.from\(\s*["']payments["']\s*\)[\s\S]*?\.update\(\s*\{[^}]*\bstatus\b/,
  /\.from\(\s*["']payments["']\s*\)[\s\S]*?\.update\(\s*\{[^}]*status:/,
];

/** Assignment only — exclude comparisons (`===`, `!==`). */
const PAYMENT_STATUS_ASSIGNMENT_PATTERNS = [/\bpayment\.status\s*=(?!=)/];

const SQL_PAYMENT_STATUS_UPDATE = [
  /update\s+public\.payments[\s\S]*?\bstatus\s*=/i,
];

describe("payment status mutation guard (static)", () => {
  it("does not patch payments.status from the app layer outside approved adapters", () => {
    const updateViolations = scanSrcForPatterns({
      allowedRelPaths: ALLOWED_PAYMENT_STATUS_WRITE_SRC,
      patterns: PAYMENT_STATUS_UPDATE_PATTERNS,
    });
    expect(updateViolations).toEqual([]);
  });

  it("does not assign payment.status outside approved adapters", () => {
    const assignViolations = scanSrcForPatterns({
      allowedRelPaths: ALLOWED_PAYMENT_STATUS_WRITE_SRC,
      patterns: PAYMENT_STATUS_ASSIGNMENT_PATTERNS,
    });
    expect(assignViolations).toEqual([]);
  });

  it("does not add new SQL migrations that UPDATE payments.status outside booking RPCs", () => {
    const violations = scanMigrationsForPatterns({
      allowedRelPaths: ALLOWED_PAYMENT_STATUS_WRITE_SQL,
      patterns: SQL_PAYMENT_STATUS_UPDATE,
    });
    expect(violations).toEqual([]);
  });
});
