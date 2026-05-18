import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260523120000_booking_cleaners_team_foundation.sql",
);

const SQL_TEST_PATH = path.join(
  process.cwd(),
  "supabase/tests/booking_cleaners_rls_nf7c_checks.sql",
);

const ASSIGNMENT_ONE_OPEN_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260517300000_assignment_offer_one_open_per_booking.sql",
);

const BOOKING_COMMAND_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260515203000_booking_command_layer.sql",
);

describe("booking_cleaners team foundation migration (NF-7C)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const sqlTest = readFileSync(SQL_TEST_PATH, "utf8");
  const assignmentSql = readFileSync(ASSIGNMENT_ONE_OPEN_PATH, "utf8");
  const commandSql = readFileSync(BOOKING_COMMAND_PATH, "utf8");

  it("creates booking_cleaners with role and status enums", () => {
    expect(sql).toMatch(/booking_cleaner_role as enum \('primary', 'support'\)/i);
    expect(sql).toMatch(/booking_cleaner_status as enum/i);
    expect(sql).toMatch(/'planned'/);
    expect(sql).toMatch(/'completed'/);
  });

  it("defines required columns and FKs", () => {
    expect(sql).toMatch(/create table if not exists public\.booking_cleaners/i);
    expect(sql).toMatch(/booking_id uuid not null references public\.bookings/i);
    expect(sql).toMatch(/cleaner_id uuid not null references public\.cleaners/i);
    expect(sql).toMatch(/role public\.booking_cleaner_role not null/i);
    expect(sql).toMatch(/status public\.booking_cleaner_status not null default 'planned'/i);
    expect(sql).toMatch(/assigned_by_profile_id uuid references public\.profiles/i);
    expect(sql).toMatch(/created_at timestamptz/i);
    expect(sql).toMatch(/updated_at timestamptz/i);
  });

  it("enforces one cleaner per booking and one active primary", () => {
    expect(sql).toMatch(/booking_cleaners_booking_cleaner_unique unique \(booking_id, cleaner_id\)/i);
    expect(sql).toMatch(/idx_booking_cleaners_one_active_primary/i);
    expect(sql).toMatch(/where role = 'primary'/i);
    expect(sql).toMatch(/status not in \('removed', 'declined'\)/i);
  });

  it("allows primary and support roles via enum (insert-ready)", () => {
    expect(sql).toMatch(/'primary'/);
    expect(sql).toMatch(/'support'/);
  });

  it("enables RLS with admin read/write and cleaner read-only", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/booking_cleaners_select_cleaner/i);
    expect(sql).toMatch(/cleaner_id = public\.auth_cleaner_id\(\)/i);
    expect(sql).toMatch(/booking_cleaners_select_admin/i);
    expect(sql).toMatch(/booking_cleaners_admin_write/i);
    expect(sql).not.toMatch(/booking_cleaners_select_customer/i);
  });

  it("does not modify assignment engine, payout, or booking command layer", () => {
    expect(sql).not.toMatch(/alter table public\.assignment_offers/i);
    expect(sql).not.toMatch(/alter table public\.earning_lines/i);
    expect(sql).not.toMatch(/booking_apply_transition/i);
    expect(sql).not.toMatch(/alter table public\.bookings/i);
    expect(sql).not.toMatch(/create unique index.*assignment_offers/i);
    expect(assignmentSql).not.toMatch(/booking_cleaners/i);
    expect(commandSql).not.toMatch(/booking_cleaners/i);
  });

  it("documents bookings.cleaner_id as remaining dispatch authority", () => {
    expect(sql).toMatch(/bookings\.cleaner_id remains/i);
  });

  it("ships SQL verification for RLS and indexes", () => {
    expect(sqlTest).toMatch(/booking_cleaners_select_cleaner/i);
    expect(sqlTest).toMatch(/booking_cleaners_admin_write/i);
    expect(sqlTest).toMatch(/idx_booking_cleaners_one_active_primary/i);
    expect(sqlTest).toMatch(/must not expose customer policies/i);
  });
});
