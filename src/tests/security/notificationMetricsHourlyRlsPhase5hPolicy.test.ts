import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

const PHASE5H_MIGRATION = "20260518220000_notification_metrics_hourly.sql";
const PHASE5H_SQL_CHECKS = "notification_metrics_hourly_rls_phase5h_checks.sql";

describe("notification_metrics_hourly RLS phase 5H-b policy catalog (static)", () => {
  it("ships forward migration with table and admin select policy", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE5H_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE5H_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table if not exists public\.notification_metrics_hourly/i);
    expect(sql).toMatch(
      /create\s+policy\s+notification_metrics_hourly_select_admin\s+on\s+public\.notification_metrics_hourly/i,
    );
    expect(sql).toMatch(/for\s+select\s+to\s+authenticated/i);
    expect(sql).not.toMatch(/forbid_admin_operational_audit_mutation/i);
    expect(sql).not.toMatch(/for\s+all\b/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE5H_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE5H_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/notification_metrics_hourly_select_admin/i);
    expect(sql).toMatch(/RLS must be enabled on public\.notification_metrics_hourly/i);
  });
});
