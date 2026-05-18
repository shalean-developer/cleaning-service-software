import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PHASE_E_MIGRATION = "20260601120000_cleaner_lifecycle_service_commands_phase_e.sql";

describe("cleaner lifecycle service commands Phase E migration (static)", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", PHASE_E_MIGRATION),
    "utf8",
  );

  it("adds enable_cleaner_lifecycle_column_write helper", () => {
    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.enable_cleaner_lifecycle_column_write\(\)/i,
    );
    expect(sql).toMatch(
      /set_config\('app\.cleaner_lifecycle_column_write',\s*'1',\s*true\)/i,
    );
  });

  it("grants execute to service_role only", () => {
    expect(sql).toMatch(/grant execute on function public\.enable_cleaner_lifecycle_column_write/i);
    expect(sql).toMatch(/to service_role/i);
  });

  it("does not alter assignment, payout, or booking lifecycle tables", () => {
    expect(sql).not.toMatch(/alter table public\.bookings/i);
    expect(sql).not.toMatch(/alter table public\.payments/i);
    expect(sql).not.toMatch(/assignment_offers/i);
  });
});
