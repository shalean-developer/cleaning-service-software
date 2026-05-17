import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260518210000_notification_worker_runs.sql",
);

describe("notification_worker_runs migration (Stage 5G-a)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates notification_worker_runs with required columns", () => {
    expect(sql).toMatch(/create table if not exists public\.notification_worker_runs/i);
    expect(sql).toMatch(/started_at timestamptz/i);
    expect(sql).toMatch(/completed_at timestamptz not null/i);
    expect(sql).toMatch(/ok boolean not null/i);
    expect(sql).toMatch(/delivery_enabled boolean not null/i);
    expect(sql).toMatch(/trigger_source text not null default 'cron'/i);
    expect(sql).toMatch(/errors jsonb not null default/i);
  });

  it("adds indexes for completed_at, ok, and trigger_source", () => {
    expect(sql).toMatch(/idx_notification_worker_runs_completed_at/i);
    expect(sql).toMatch(/idx_notification_worker_runs_ok_completed_at/i);
    expect(sql).toMatch(/idx_notification_worker_runs_trigger_completed_at/i);
  });

  it("constrains trigger_source values", () => {
    expect(sql).toMatch(/trigger_source in \('cron', 'manual'\)/i);
  });

  it("enables append-only trigger", () => {
    expect(sql).toMatch(/notification_worker_runs_append_only/i);
    expect(sql).toMatch(/forbid_admin_operational_audit_mutation/i);
  });

  it("enables RLS with admin select only", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/notification_worker_runs_select_admin/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
    expect(sql).not.toMatch(/for insert to authenticated/i);
    expect(sql).not.toMatch(/for update to authenticated/i);
    expect(sql).not.toMatch(/for delete to authenticated/i);
  });

  it("grants insert to service_role only", () => {
    expect(sql).toMatch(/grant insert on public\.notification_worker_runs to service_role/i);
  });
});
