import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260520120000_assignment_metrics_hourly.sql",
);

describe("assignment_metrics_hourly migration (Stage 7B-1a)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates assignment_metrics_hourly with counter columns only", () => {
    expect(sql).toMatch(/create table if not exists public\.assignment_metrics_hourly/i);
    expect(sql).toMatch(/bucket_start timestamptz primary key/i);
    expect(sql).toMatch(/offers_created_count integer not null/i);
    expect(sql).toMatch(/admin_intervention_count integer not null/i);
    expect(sql).not.toMatch(/cleaner_id/i);
    expect(sql).not.toMatch(/customer_id/i);
    expect(sql).not.toMatch(/payload/i);
    expect(sql).not.toMatch(/email/i);
  });

  it("enables RLS with admin select only", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/assignment_metrics_hourly_select_admin/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
    expect(sql).not.toMatch(/for insert to authenticated/i);
  });

  it("grants insert and update to service_role only", () => {
    expect(sql).toMatch(/grant insert, update on public\.assignment_metrics_hourly to service_role/i);
  });
});
