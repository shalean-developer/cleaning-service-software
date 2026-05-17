import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

const PHASE3C_MIGRATION = "20260518160000_rls_assignment_offers_admin_select_only.sql";
const PHASE3C_SQL_CHECKS = "assignment_offers_rls_phase3c_checks.sql";
const RLS_BASE_MIGRATION = "20260516160000_rls_role_security.sql";

describe("assignment_offers RLS phase 3c policy catalog (static, 5B-3c-a)", () => {
  it("ships forward migration that drops assignment_offers_admin_write only", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE3C_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE3C_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(
      /drop\s+policy\s+if\s+exists\s+assignment_offers_admin_write\s+on\s+public\.assignment_offers/i,
    );
    expect(sql).not.toMatch(/create\s+policy\s+assignment_offers_admin_write/i);
    expect(sql).not.toMatch(/assignment_offers_update_cleaner/i);
    expect(sql).not.toMatch(/assignment_offers_select_/i);
    expect(sql).not.toMatch(/\bpayments\b/i);
    expect(sql).not.toMatch(/earning_lines/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE3C_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE3C_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/assignment_offers_admin_write must be dropped/i);
    expect(sql).toMatch(/assignment_offers_select_admin/i);
    expect(sql).toMatch(/assignment_offers_select_cleaner/i);
    expect(sql).toMatch(/assignment_offers_select_customer/i);
    expect(sql).toMatch(/assignment_offers_update_cleaner/i);
    expect(sql).toMatch(/RLS must be enabled on public\.assignment_offers/i);
  });

  it("base RLS migration still defines select and cleaner update policies", () => {
    const basePath = path.join(MIGRATIONS_ROOT, RLS_BASE_MIGRATION);
    const sql = readFileSync(basePath, "utf8");

    expect(sql).toMatch(/create\s+policy\s+assignment_offers_select_admin/i);
    expect(sql).toMatch(/create\s+policy\s+assignment_offers_select_cleaner/i);
    expect(sql).toMatch(/create\s+policy\s+assignment_offers_select_customer/i);
    expect(sql).toMatch(/create\s+policy\s+assignment_offers_update_cleaner/i);
    expect(sql).toMatch(/create\s+policy\s+assignment_offers_admin_write/i);
  });

  it("documents rollback SQL for assignment_offers_admin_write", () => {
    const rollbackPath = path.resolve(
      process.cwd(),
      "docs/operations/rls-tightening-rollbacks.md",
    );
    expect(existsSync(rollbackPath)).toBe(true);

    const doc = readFileSync(rollbackPath, "utf8");
    expect(doc).toMatch(/create\s+policy\s+assignment_offers_admin_write/i);
    expect(doc).toMatch(/20260518160000_rls_assignment_offers_admin_select_only/);
  });
});
