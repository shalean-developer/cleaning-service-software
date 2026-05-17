import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

const PHASE5F_MIGRATION = "20260518200000_rls_notification_outbox_admin_select_only.sql";
const PHASE5F_SQL_CHECKS = "notification_outbox_rls_phase5f_checks.sql";
const RLS_BASE_MIGRATION = "20260516160000_rls_role_security.sql";

describe("notification_outbox RLS phase 5F-a policy catalog (static)", () => {
  it("ships forward migration that drops notification_outbox_admin and adds SELECT-only policy", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE5F_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE5F_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(
      /drop\s+policy\s+if\s+exists\s+notification_outbox_admin\s+on\s+public\.notification_outbox/i,
    );
    expect(sql).toMatch(
      /create\s+policy\s+notification_outbox_select_admin\s+on\s+public\.notification_outbox/i,
    );
    expect(sql).toMatch(/for\s+select\s+to\s+authenticated/i);
    expect(sql).not.toMatch(/create\s+policy\s+notification_outbox_admin/i);
    expect(sql).not.toMatch(/\bfor\s+all\b/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE5F_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE5F_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/notification_outbox_admin must be dropped/i);
    expect(sql).toMatch(/notification_outbox_select_admin/i);
    expect(sql).toMatch(/RLS must be enabled on public\.notification_outbox/i);
  });

  it("base RLS migration still defines notification_outbox_admin FOR ALL", () => {
    const basePath = path.join(MIGRATIONS_ROOT, RLS_BASE_MIGRATION);
    const sql = readFileSync(basePath, "utf8");

    expect(sql).toMatch(/create\s+policy\s+notification_outbox_admin/i);
    expect(sql).toMatch(/for\s+all\s+to\s+authenticated/i);
  });

  it("documents rollback SQL for notification_outbox_admin", () => {
    const rollbackPath = path.resolve(
      process.cwd(),
      "docs/operations/rls-tightening-rollbacks.md",
    );
    expect(existsSync(rollbackPath)).toBe(true);

    const doc = readFileSync(rollbackPath, "utf8");
    expect(doc).toMatch(/create\s+policy\s+notification_outbox_admin/i);
    expect(doc).toMatch(/20260518200000_rls_notification_outbox_admin_select_only/);
  });
});
