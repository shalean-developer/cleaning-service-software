import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

const PHASE3B_MIGRATION = "20260518150000_rls_earning_lines_admin_select_only.sql";
const PHASE3B_SQL_CHECKS = "earning_lines_rls_phase3b_checks.sql";
const RLS_BASE_MIGRATION = "20260516160000_rls_role_security.sql";

describe("earning_lines RLS phase 3b policy catalog (static, 5B-3b-a)", () => {
  it("ships forward migration that drops earning_lines_admin_write only", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE3B_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE3B_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(
      /drop\s+policy\s+if\s+exists\s+earning_lines_admin_write\s+on\s+public\.earning_lines/i,
    );
    expect(sql).not.toMatch(/create\s+policy\s+earning_lines_admin_write/i);
    expect(sql).not.toMatch(/\bpayments\b/i);
    expect(sql).not.toMatch(/assignment_offers/i);
    expect(sql).not.toMatch(/payout_batches/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE3B_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE3B_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/earning_lines_admin_write must be dropped/i);
    expect(sql).toMatch(/earning_lines_select_admin/i);
    expect(sql).toMatch(/earning_lines_select_cleaner/i);
    expect(sql).toMatch(/RLS must be enabled on public\.earning_lines/i);
  });

  it("base RLS migration still defines select policies for earning_lines", () => {
    const basePath = path.join(MIGRATIONS_ROOT, RLS_BASE_MIGRATION);
    const sql = readFileSync(basePath, "utf8");

    expect(sql).toMatch(/create\s+policy\s+earning_lines_select_admin/i);
    expect(sql).toMatch(/create\s+policy\s+earning_lines_select_cleaner/i);
    expect(sql).toMatch(/create\s+policy\s+earning_lines_admin_write/i);
  });

  it("documents rollback SQL for earning_lines_admin_write", () => {
    const rollbackPath = path.resolve(
      process.cwd(),
      "docs/operations/rls-tightening-rollbacks.md",
    );
    expect(existsSync(rollbackPath)).toBe(true);

    const doc = readFileSync(rollbackPath, "utf8");
    expect(doc).toMatch(/create\s+policy\s+earning_lines_admin_write/i);
    expect(doc).toMatch(/20260518150000_rls_earning_lines_admin_select_only/);
  });
});
