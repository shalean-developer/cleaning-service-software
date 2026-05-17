import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

const PHASE5G_MIGRATION = "20260518210000_notification_worker_runs.sql";
const PHASE5G_SQL_CHECKS = "notification_worker_runs_rls_phase5g_checks.sql";

describe("notification_worker_runs RLS phase 5G-a policy catalog (static)", () => {
  it("ships forward migration with table, RLS, and append-only trigger", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE5G_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE5G_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table if not exists public\.notification_worker_runs/i);
    expect(sql).toMatch(
      /create\s+policy\s+notification_worker_runs_select_admin\s+on\s+public\.notification_worker_runs/i,
    );
    expect(sql).toMatch(/for\s+select\s+to\s+authenticated/i);
    expect(sql).toMatch(/notification_worker_runs_append_only/i);
    expect(sql).not.toMatch(/for\s+all\b/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE5G_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE5G_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/notification_worker_runs_select_admin/i);
    expect(sql).toMatch(/RLS must be enabled on public\.notification_worker_runs/i);
  });
});
