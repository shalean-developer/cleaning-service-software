import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260517210000_booking_lock_retry_active_unique.sql",
);

const ORIGINAL_LOCK_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260516190000_booking_payment_lock.sql",
);

const SQL_TEST_PATH = path.join(
  process.cwd(),
  "supabase/tests/booking_lock_retry_active_unique.sql",
);

describe("booking lock retry active unique migration (Stage 2B-2c-1)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const originalLockSql = readFileSync(ORIGINAL_LOCK_MIGRATION_PATH, "utf8");
  const sqlTest = readFileSync(SQL_TEST_PATH, "utf8");

  it("drops the one-lock-per-booking-forever constraint", () => {
    expect(sql).toMatch(
      /drop constraint if exists booking_locks_booking_id_unique/i,
    );
    expect(originalLockSql).toMatch(/booking_locks_booking_id_unique unique \(booking_id\)/);
  });

  it("adds partial unique index for one active lock per booking", () => {
    expect(sql).toMatch(/booking_locks_one_active_per_booking_idx/i);
    expect(sql).toMatch(/unique index if not exists booking_locks_one_active_per_booking_idx/i);
    expect(sql).toMatch(/on public\.booking_locks \(booking_id\)/i);
    expect(sql).toMatch(/where \(status = 'active'::public\.booking_lock_status\)/i);
  });

  it("defines active lock via status enum, not expires_at alone", () => {
    expect(sql).toContain("status = 'active'");
    expect(sql).not.toMatch(/where\s*\(\s*expires_at/i);
    expect(sql).not.toMatch(/drop table/i);
    expect(sql).not.toMatch(/delete from/i);
  });

  it("does not modify payments, bookings, commands, or RLS", () => {
    expect(sql).not.toMatch(/public\.payments/i);
    expect(sql).not.toMatch(/public\.bookings/i);
    expect(sql).not.toMatch(/booking_record_payment_failure/i);
    expect(sql).not.toMatch(/policy/i);
    expect(sql).not.toMatch(/enable row level security/i);
  });

  it("preserves idempotency_key uniqueness from original migration", () => {
    expect(originalLockSql).toMatch(/booking_locks_idempotency_key_unique/);
    expect(sql).not.toMatch(/drop constraint.*idempotency_key/i);
  });

  it("ships SQL verification for lock insert rules", () => {
    expect(sqlTest).toMatch(/booking_locks_booking_id_unique/i);
    expect(sqlTest).toMatch(/booking_locks_one_active_per_booking_idx/i);
    expect(sqlTest).toMatch(/'consumed'/i);
    expect(sqlTest).toMatch(/'expired'/i);
    expect(sqlTest).toMatch(/status = 'active'/i);
    expect(sqlTest).toMatch(/unique_violation/i);
    expect(sqlTest).toMatch(/rollback/i);
  });
});
