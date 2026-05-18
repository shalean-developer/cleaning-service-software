import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260526120000_team_earnings_nf7g.sql",
);

const SQL_TEST_PATH = path.join(
  process.cwd(),
  "supabase/tests/team_earnings_nf7g_checks.sql",
);

describe("team earnings migration (NF-7G)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const sqlTest = readFileSync(SQL_TEST_PATH, "utf8");

  it("adds team earning role and source columns", () => {
    expect(sql).toMatch(/team_earning_role text/i);
    expect(sql).toMatch(/team_earning_source text/i);
  });

  it("replaces booking_completion singleton with per-cleaner uniqueness", () => {
    expect(sql).toMatch(/drop index if exists public\.earning_lines_booking_completion_unique/i);
    expect(sql).toMatch(/earning_lines_booking_cleaner_completion_unique/i);
    expect(sql).toMatch(/team_support_completion/);
  });

  it("does not alter bookings lifecycle or payments", () => {
    expect(sql).not.toMatch(/alter table public\.bookings/i);
    expect(sql).not.toMatch(/alter table public\.payments/i);
    expect(sql).not.toMatch(/booking_apply_transition/i);
  });

  it("sql checks reference NF-7G index and columns", () => {
    expect(sqlTest).toMatch(/team_earning_role/i);
    expect(sqlTest).toMatch(/earning_lines_booking_cleaner_completion_unique/i);
  });
});
