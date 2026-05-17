import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

const PHASE1_MIGRATION = "20260518140000_rls_payments_admin_select_only.sql";
const PHASE1_SQL_CHECKS = "payments_rls_phase1_checks.sql";
const RLS_BASE_MIGRATION = "20260516160000_rls_role_security.sql";

describe("payments RLS phase 1 policy catalog (static, 5B-3a)", () => {
  it("ships forward migration that drops payments_admin_write only", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE1_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE1_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/drop\s+policy\s+if\s+exists\s+payments_admin_write\s+on\s+public\.payments/i);
    expect(sql).not.toMatch(/create\s+policy\s+payments_admin_write/i);
    expect(sql).not.toMatch(/payment_events/i);
    expect(sql).not.toMatch(/\bbookings\b/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE1_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE1_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/payments_admin_write must be dropped/i);
    expect(sql).toMatch(/payments_select_admin/i);
    expect(sql).toMatch(/payments_select_customer/i);
  });

  it("base RLS migration still defines select policies for payments", () => {
    const basePath = path.join(MIGRATIONS_ROOT, RLS_BASE_MIGRATION);
    const sql = readFileSync(basePath, "utf8");

    expect(sql).toMatch(/create\s+policy\s+payments_select_admin/i);
    expect(sql).toMatch(/create\s+policy\s+payments_select_customer/i);
    expect(sql).toMatch(/create\s+policy\s+payments_admin_write/i);
  });

  it("documents rollback SQL for payments_admin_write", () => {
    const rollbackPath = path.resolve(
      process.cwd(),
      "docs/operations/rls-tightening-rollbacks.md",
    );
    expect(existsSync(rollbackPath)).toBe(true);

    const doc = readFileSync(rollbackPath, "utf8");
    expect(doc).toMatch(/create\s+policy\s+payments_admin_write/i);
    expect(doc).toMatch(/20260518140000_rls_payments_admin_select_only/);
  });
});
