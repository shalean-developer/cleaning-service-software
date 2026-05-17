import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260518220000_notification_metrics_hourly.sql",
);

describe("notification_metrics_hourly migration (Stage 5H-b)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates notification_metrics_hourly with counter columns only", () => {
    expect(sql).toMatch(/create table if not exists public\.notification_metrics_hourly/i);
    expect(sql).toMatch(/bucket_start timestamptz primary key/i);
    expect(sql).toMatch(/run_count integer not null/i);
    expect(sql).toMatch(/live_sent_count integer not null/i);
    expect(sql).toMatch(/live_failed_count integer not null/i);
    expect(sql).not.toMatch(/errors jsonb/i);
    expect(sql).not.toMatch(/payload/i);
    expect(sql).not.toMatch(/recipient/i);
    expect(sql).not.toMatch(/template/i);
  });

  it("indexes bucket_start for trend queries", () => {
    expect(sql).toMatch(/idx_notification_metrics_hourly_bucket_desc/i);
  });

  it("enables RLS with admin select only", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/notification_metrics_hourly_select_admin/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
    expect(sql).not.toMatch(/for insert to authenticated/i);
    expect(sql).not.toMatch(/for update to authenticated/i);
  });

  it("grants insert and update to service_role only", () => {
    expect(sql).toMatch(/grant insert, update on public\.notification_metrics_hourly to service_role/i);
  });
});
