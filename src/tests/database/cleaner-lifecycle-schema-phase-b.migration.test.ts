import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PHASE_B_MIGRATION = "20260530120000_cleaner_lifecycle_schema_phase_b.sql";
const PHASE_B_SQL_CHECKS = "cleaner_lifecycle_schema_phase_b_checks.sql";
const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

describe("cleaner lifecycle schema Phase B migration (static)", () => {
  const migrationPath = path.join(MIGRATIONS_ROOT, PHASE_B_MIGRATION);

  it("ships forward migration file", () => {
    expect(existsSync(migrationPath), `missing ${PHASE_B_MIGRATION}`).toBe(true);
  });

  const sql = readFileSync(migrationPath, "utf8");

  it("adds cleaner lifecycle columns", () => {
    expect(sql).toMatch(/add column if not exists deleted_at timestamptz/i);
    expect(sql).toMatch(/add column if not exists onboarding_completed_at timestamptz/i);
    expect(sql).toMatch(/add column if not exists suspension_ends_at timestamptz/i);
    expect(sql).toMatch(/add column if not exists lifecycle_reason text/i);
  });

  it("backfills onboarding_completed_at from created_at where null", () => {
    expect(sql).toMatch(
      /update public\.cleaners[\s\S]*set onboarding_completed_at = created_at[\s\S]*where onboarding_completed_at is null/i,
    );
  });

  it("adds partial indexes on cleaners", () => {
    expect(sql).toMatch(/idx_cleaners_not_deleted/i);
    expect(sql).toMatch(/where deleted_at is null/i);
    expect(sql).toMatch(/idx_cleaners_active_not_deleted/i);
    expect(sql).toMatch(/active = true/i);
    expect(sql).toMatch(/idx_cleaners_suspended_window/i);
    expect(sql).toMatch(/suspended_at, suspension_ends_at/i);
  });

  it("creates cleaner_operational_audit with expected columns", () => {
    expect(sql).toMatch(/create table if not exists public\.cleaner_operational_audit/i);
    expect(sql).toMatch(/cleaner_id uuid not null/i);
    expect(sql).toMatch(/admin_profile_id uuid/i);
    expect(sql).toMatch(/action text not null/i);
    expect(sql).toMatch(/outcome text not null/i);
    expect(sql).toMatch(/before_state jsonb not null default/i);
    expect(sql).toMatch(/after_state jsonb not null default/i);
    expect(sql).toMatch(/affected_counts jsonb not null default/i);
    expect(sql).toMatch(/metadata jsonb not null default/i);
    expect(sql).toMatch(/idempotency_key text/i);
    expect(sql).toMatch(/created_at timestamptz not null default now\(\)/i);
  });

  it("constrains non-empty action and outcome", () => {
    expect(sql).toMatch(/cleaner_operational_audit_action_nonempty/i);
    expect(sql).toMatch(/length\(trim\(action\)\) > 0/i);
    expect(sql).toMatch(/cleaner_operational_audit_outcome_nonempty/i);
    expect(sql).toMatch(/length\(trim\(outcome\)\) > 0/i);
  });

  it("enables append-only trigger", () => {
    expect(sql).toMatch(/forbid_cleaner_operational_audit_mutation/i);
    expect(sql).toMatch(/cleaner_operational_audit_append_only/i);
  });

  it("enables RLS with admin select only", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/cleaner_operational_audit_select_admin/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
    expect(sql).not.toMatch(/for insert to authenticated/i);
    expect(sql).not.toMatch(/for update to authenticated/i);
    expect(sql).not.toMatch(/for delete to authenticated/i);
  });

  it("grants insert to service_role only", () => {
    expect(sql).toMatch(/grant insert on public\.cleaner_operational_audit to service_role/i);
  });

  it("does not add lifecycle RPCs or command functions", () => {
    expect(sql).not.toMatch(/booking_apply_transition/i);
    expect(sql).not.toMatch(
      /create\s+or\s+replace\s+function\s+public\.(deactivate|suspend|reactivate|archive)_cleaner/i,
    );
    expect(sql).not.toMatch(/security definer/i);
  });

  it("does not touch UI routes or admin cleaner pages", () => {
    expect(sql).not.toMatch(/\/admin\/cleaners/i);
    expect(sql).not.toMatch(/app\/admin/i);
  });

  it("does not change assignment, payout, or booking lifecycle", () => {
    expect(sql).not.toMatch(/alter table public\.assignment_offers/i);
    expect(sql).not.toMatch(/alter table public\.bookings/i);
    expect(sql).not.toMatch(/alter table public\.payments/i);
    expect(sql).not.toMatch(/alter table public\.earning_lines/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE_B_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE_B_SQL_CHECKS}`).toBe(true);

    const checksSql = readFileSync(checksPath, "utf8");
    expect(checksSql).toMatch(/deleted_at column missing/i);
    expect(checksSql).toMatch(/onboarding_completed_at backfill incomplete/i);
    expect(checksSql).toMatch(/cleaner_operational_audit RLS must be enabled/i);
  });
});
