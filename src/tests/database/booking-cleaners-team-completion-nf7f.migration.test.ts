import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260525120000_booking_cleaners_team_completion_nf7f.sql",
);

const SQL_TEST_PATH = path.join(
  process.cwd(),
  "supabase/tests/booking_cleaners_team_completion_nf7f_checks.sql",
);

describe("booking_cleaners team completion migration (NF-7F)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const sqlTest = readFileSync(SQL_TEST_PATH, "utf8");

  it("adds support participation columns", () => {
    expect(sql).toMatch(/support_completed_at timestamptz/i);
    expect(sql).toMatch(/support_note text/i);
  });

  it("allows support cleaners to self-complete roster row", () => {
    expect(sql).toMatch(/booking_cleaners_support_complete_self/i);
    expect(sql).toMatch(/role = 'support'/i);
    expect(sql).toMatch(/status = 'completed'/i);
  });

  it("does not alter booking lifecycle or payout tables", () => {
    expect(sql).not.toMatch(/alter table public\.bookings/i);
    expect(sql).not.toMatch(/alter table public\.earning_lines/i);
    expect(sql).not.toMatch(/booking_apply_transition/i);
    expect(sql).not.toMatch(/assignment_offers/i);
  });

  it("sql checks reference NF-7F columns and policy", () => {
    expect(sqlTest).toMatch(/support_completed_at/i);
    expect(sqlTest).toMatch(/booking_cleaners_support_complete_self/i);
  });
});
