import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PHASE_C_MIGRATION = "20260531120000_cleaner_lifecycle_column_guard_phase_c.sql";
const PHASE_C_SQL_CHECKS = "cleaner_lifecycle_column_guard_phase_c_checks.sql";
const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

describe("cleaner lifecycle column guard Phase C migration (static)", () => {
  const migrationPath = path.join(MIGRATIONS_ROOT, PHASE_C_MIGRATION);

  it("ships forward migration file", () => {
    expect(existsSync(migrationPath), `missing ${PHASE_C_MIGRATION}`).toBe(true);
  });

  const sql = readFileSync(migrationPath, "utf8");

  it("creates guard_cleaner_lifecycle_columns trigger function", () => {
    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.guard_cleaner_lifecycle_columns\(\)/i,
    );
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/set search_path = public/i);
  });

  it("blocks authenticated lifecycle column updates", () => {
    expect(sql).toMatch(/auth\.uid\(\) is null/i);
    expect(sql).toMatch(/new\.active is distinct from old\.active/i);
    expect(sql).toMatch(/new\.suspended_at is distinct from old\.suspended_at/i);
    expect(sql).toMatch(/new\.suspension_ends_at is distinct from old\.suspension_ends_at/i);
    expect(sql).toMatch(/new\.deleted_at is distinct from old\.deleted_at/i);
    expect(sql).toMatch(
      /new\.onboarding_completed_at is distinct from old\.onboarding_completed_at/i,
    );
    expect(sql).toMatch(/new\.lifecycle_reason is distinct from old\.lifecycle_reason/i);
    expect(sql).toMatch(/CLEANER_LIFECYCLE_COLUMN_MUTATION_FORBIDDEN/i);
  });

  it("allows service_role and future lifecycle RPC bypass", () => {
    expect(sql).toMatch(/app\.cleaner_lifecycle_column_write/i);
  });

  it("attaches before update trigger on cleaners", () => {
    expect(sql).toMatch(/guard_cleaner_lifecycle_columns on public\.cleaners/i);
    expect(sql).toMatch(/before update on public\.cleaners/i);
  });

  it("does not add lifecycle RPCs or UI", () => {
    expect(sql).not.toMatch(/deactivate_cleaner|suspend_cleaner|archive_cleaner/i);
    expect(sql).not.toMatch(/\/admin\/cleaners/i);
  });

  it("does not change assignment, payout, or booking lifecycle", () => {
    expect(sql).not.toMatch(/alter table public\.assignment_offers/i);
    expect(sql).not.toMatch(/alter table public\.bookings/i);
    expect(sql).not.toMatch(/alter table public\.payments/i);
    expect(sql).not.toMatch(/alter table public\.earning_lines/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE_C_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE_C_SQL_CHECKS}`).toBe(true);

    const checksSql = readFileSync(checksPath, "utf8");
    expect(checksSql).toMatch(/guard_cleaner_lifecycle_columns function missing/i);
    expect(checksSql).toMatch(/trigger missing on public\.cleaners/i);
  });
});
