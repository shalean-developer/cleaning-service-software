import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260517300000_assignment_offer_one_open_per_booking.sql",
);

const PRIOR_INTEGRITY_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260516200000_assignment_offer_integrity.sql",
);

const SQL_TEST_PATH = path.join(
  process.cwd(),
  "supabase/tests/assignment_offer_one_open_per_booking.sql",
);

describe("assignment offer one open per booking migration (Stage 3C-a)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const priorSql = readFileSync(PRIOR_INTEGRITY_MIGRATION_PATH, "utf8");
  const sqlTest = readFileSync(SQL_TEST_PATH, "utf8");

  it("backfills duplicate offered rows to cancelled without deleting", () => {
    expect(sql).toMatch(/where status = 'offered'/i);
    expect(sql).toMatch(/status = 'cancelled'/i);
    expect(sql).toMatch(/row_number\(\) over/i);
    expect(sql).toMatch(/order by offered_at desc nulls last/i);
    expect(sql).not.toMatch(/delete from/i);
  });

  it("adds partial unique index on booking_id for offered status", () => {
    expect(sql).toMatch(/idx_assignment_offers_one_open_per_booking/i);
    expect(sql).toMatch(
      /create unique index if not exists idx_assignment_offers_one_open_per_booking/i,
    );
    expect(sql).toMatch(/on public\.assignment_offers \(booking_id\)/i);
    expect(sql).toMatch(/where status = 'offered'/i);
  });

  it("preserves per-cleaner partial unique index from prior migration", () => {
    expect(priorSql).toMatch(/idx_assignment_offers_one_open_per_cleaner/i);
    expect(sql).not.toMatch(/drop index.*one_open_per_cleaner/i);
  });

  it("does not modify RLS, payments, or booking transitions", () => {
    expect(sql).not.toMatch(/policy/i);
    expect(sql).not.toMatch(/enable row level security/i);
    expect(sql).not.toMatch(/public\.payments/i);
    expect(sql).not.toMatch(/booking_apply_transition/i);
  });

  it("ships SQL verification for index and backfill state", () => {
    expect(sqlTest).toMatch(/idx_assignment_offers_one_open_per_booking/i);
    expect(sqlTest).toMatch(/idx_assignment_offers_one_open_per_cleaner/i);
    expect(sqlTest).toMatch(/having count\(\*\) > 1/i);
  });
});
