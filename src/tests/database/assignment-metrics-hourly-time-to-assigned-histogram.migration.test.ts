import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260522120000_assignment_metrics_hourly_time_to_assigned_histogram.sql",
);

describe("assignment_metrics_hourly time-to-assigned histogram migration (Stage 7B-1c-b-min)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("adds eight non-negative histogram columns", () => {
    expect(sql).toMatch(/alter table public\.assignment_metrics_hourly/i);
    expect(sql).toMatch(/time_to_assigned_bucket_0_15m_count integer not null default 0/i);
    expect(sql).toMatch(/time_to_assigned_bucket_48h_plus_count integer not null default 0/i);
    expect(sql).toMatch(/time_to_assigned_sample_count integer not null default 0/i);
    expect(sql).toMatch(/check \(time_to_assigned_bucket_0_15m_count >= 0\)/i);
    expect(sql).toMatch(/check \(time_to_assigned_sample_count >= 0\)/i);
  });

  it("does not change RLS policies", () => {
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/drop policy/i);
    expect(sql).not.toMatch(/booking_id/i);
    expect(sql).not.toMatch(/cleaner_id/i);
  });
});
