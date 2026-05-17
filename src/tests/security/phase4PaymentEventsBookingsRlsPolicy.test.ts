import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

const PHASE4_MIGRATION = "20260518170000_rls_payment_events_bookings_admin_select_only.sql";
const PAYMENT_EVENTS_SQL_CHECKS = "payment_events_rls_phase4_checks.sql";
const BOOKINGS_SQL_CHECKS = "bookings_rls_phase4_checks.sql";
const RLS_BASE_MIGRATION = "20260516160000_rls_role_security.sql";

describe("payment_events + bookings RLS phase 4a policy catalog (static, 5B-3)", () => {
  it("ships forward migration that drops both admin write policies only", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE4_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE4_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(
      /drop\s+policy\s+if\s+exists\s+payment_events_admin_write\s+on\s+public\.payment_events/i,
    );
    expect(sql).toMatch(
      /drop\s+policy\s+if\s+exists\s+bookings_admin_write\s+on\s+public\.bookings/i,
    );
    expect(sql).not.toMatch(/create\s+policy\s+payment_events_admin_write/i);
    expect(sql).not.toMatch(/create\s+policy\s+bookings_admin_write/i);
    expect(sql).not.toMatch(/guard_booking_status_change/i);
    expect(sql).not.toMatch(/assignment_offers/i);
  });

  it("documents SQL catalog checks for payment_events", () => {
    const checksPath = path.join(TESTS_ROOT, PAYMENT_EVENTS_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PAYMENT_EVENTS_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/payment_events_admin_write must be dropped/i);
    expect(sql).toMatch(/payment_events_select_admin/i);
    expect(sql).toMatch(/payment_events_select_customer/i);
    expect(sql).toMatch(/RLS must be enabled on public\.payment_events/i);
  });

  it("documents SQL catalog checks for bookings", () => {
    const checksPath = path.join(TESTS_ROOT, BOOKINGS_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${BOOKINGS_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/bookings_admin_write must be dropped/i);
    expect(sql).toMatch(/bookings_select_admin/i);
    expect(sql).toMatch(/bookings_select_customer/i);
    expect(sql).toMatch(/bookings_select_cleaner/i);
    expect(sql).toMatch(/bookings_update_customer/i);
    expect(sql).toMatch(/guard_booking_status_change trigger must exist/i);
  });

  it("base RLS migration still defines select policies and admin write policies", () => {
    const basePath = path.join(MIGRATIONS_ROOT, RLS_BASE_MIGRATION);
    const sql = readFileSync(basePath, "utf8");

    expect(sql).toMatch(/create\s+policy\s+payment_events_select_admin/i);
    expect(sql).toMatch(/create\s+policy\s+payment_events_select_customer/i);
    expect(sql).toMatch(/create\s+policy\s+payment_events_admin_write/i);
    expect(sql).toMatch(/create\s+policy\s+bookings_select_admin/i);
    expect(sql).toMatch(/create\s+policy\s+bookings_update_customer/i);
    expect(sql).toMatch(/create\s+policy\s+bookings_admin_write/i);
    expect(sql).toMatch(/guard_booking_status_change/i);
  });

  it("documents separate rollback SQL for both policies", () => {
    const rollbackPath = path.resolve(
      process.cwd(),
      "docs/operations/rls-tightening-rollbacks.md",
    );
    expect(existsSync(rollbackPath)).toBe(true);

    const doc = readFileSync(rollbackPath, "utf8");
    expect(doc).toMatch(/create\s+policy\s+payment_events_admin_write/i);
    expect(doc).toMatch(/create\s+policy\s+bookings_admin_write/i);
    expect(doc).toMatch(/20260518170000_rls_payment_events_bookings_admin_select_only/);
  });
});
