import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260522130000_assignment_metrics_hourly_latency_histograms.sql",
);

describe("assignment_metrics_hourly latency histograms migration (Stage 7B-1c-b)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("adds sixteen non-negative histogram columns for cleaner response and time to first offer", () => {
    expect(sql).toMatch(/alter table public\.assignment_metrics_hourly/i);
    expect(sql).toMatch(/cleaner_response_bucket_0_15m_count integer not null default 0/i);
    expect(sql).toMatch(/cleaner_response_bucket_48h_plus_count integer not null default 0/i);
    expect(sql).toMatch(/cleaner_response_sample_count integer not null default 0/i);
    expect(sql).toMatch(/time_to_first_offer_bucket_0_15m_count integer not null default 0/i);
    expect(sql).toMatch(/time_to_first_offer_bucket_48h_plus_count integer not null default 0/i);
    expect(sql).toMatch(/time_to_first_offer_sample_count integer not null default 0/i);
    expect(sql).toMatch(/check \(cleaner_response_sample_count >= 0\)/i);
    expect(sql).toMatch(/check \(time_to_first_offer_sample_count >= 0\)/i);
  });

  it("does not change RLS policies", () => {
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/drop policy/i);
    expect(sql).not.toMatch(/booking_id/i);
  });
});
