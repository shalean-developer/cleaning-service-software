import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260524120000_assignment_offers_team_slots_nf7d.sql",
);

const SQL_TEST_PATH = path.join(
  process.cwd(),
  "supabase/tests/assignment_offers_team_slots_nf7d_checks.sql",
);

describe("NF-7D assignment offers team slots migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const sqlTest = readFileSync(SQL_TEST_PATH, "utf8");

  it("adds team_role and roster_id to assignment_offers", () => {
    expect(sql).toMatch(/team_role public\.booking_cleaner_role/i);
    expect(sql).toMatch(/roster_id uuid references public\.booking_cleaners/i);
  });

  it("replaces one-open-per-booking with per-slot uniqueness", () => {
    expect(sql).toMatch(/drop index if exists public\.idx_assignment_offers_one_open_per_booking/i);
    expect(sql).toMatch(/idx_assignment_offers_one_open_per_booking_team_role/i);
    expect(sql).toMatch(/\(booking_id, team_role\)/i);
    expect(sql).toMatch(/where status = 'offered'/i);
  });

  it("extends cleaner_can_access_booking for roster offered/accepted", () => {
    expect(sql).toMatch(/create or replace function public\.cleaner_can_access_booking/i);
    expect(sql).toMatch(/booking_cleaners bc/i);
    expect(sql).toMatch(/bc\.status in \('offered', 'accepted'\)/i);
  });

  it("does not modify payout, completion, or booking transitions", () => {
    expect(sql).not.toMatch(/earning_lines/i);
    expect(sql).not.toMatch(/booking_apply_transition/i);
    expect(sql).not.toMatch(/alter table public\.bookings/i);
  });

  it("ships SQL verification for NF-7D indexes and access function", () => {
    expect(sqlTest).toMatch(/idx_assignment_offers_one_open_per_booking_team_role/i);
    expect(sqlTest).toMatch(/cleaner_can_access_booking/i);
  });
});
