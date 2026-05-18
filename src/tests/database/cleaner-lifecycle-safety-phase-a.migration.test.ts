import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PHASE_A_MIGRATION = "20260529120000_cleaner_lifecycle_safety_phase_a.sql";
const PHASE_A_SQL_CHECKS = "cleaner_lifecycle_safety_phase_a_checks.sql";
const RLS_BASE_MIGRATION = "20260516160000_rls_role_security.sql";

const MIGRATIONS_ROOT = path.resolve(process.cwd(), "supabase/migrations");
const TESTS_ROOT = path.resolve(process.cwd(), "supabase/tests");

describe("cleaner lifecycle safety Phase A migration (static)", () => {
  it("ships forward migration that drops cleaners_admin_delete and revokes authenticated DELETE", () => {
    const migrationPath = path.join(MIGRATIONS_ROOT, PHASE_A_MIGRATION);
    expect(existsSync(migrationPath), `missing ${PHASE_A_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(
      /drop\s+policy\s+if\s+exists\s+cleaners_admin_delete\s+on\s+public\.cleaners/i,
    );
    expect(sql).not.toMatch(/create\s+policy\s+cleaners_admin_delete/i);
    expect(sql).toMatch(/revoke\s+delete\s+on\s+public\.cleaners\s+from\s+authenticated/i);
  });

  it("sets operational cleaner FKs to ON DELETE RESTRICT", () => {
    const sql = readFileSync(path.join(MIGRATIONS_ROOT, PHASE_A_MIGRATION), "utf8");

    expect(sql).toMatch(/assignment_offers[\s\S]*on delete restrict/i);
    expect(sql).toMatch(/earning_lines[\s\S]*on delete restrict/i);
    expect(sql).toMatch(/bookings[\s\S]*on delete restrict/i);
    expect(sql).toMatch(/cleaner_service_areas[\s\S]*on delete restrict/i);
    expect(sql).toMatch(/cleaner_service_capabilities[\s\S]*on delete restrict/i);
    expect(sql).toMatch(/cleaner_availability[\s\S]*on delete restrict/i);
    expect(sql).toMatch(/cleaner_time_off[\s\S]*on delete restrict/i);
  });

  it("does not change admin_operational_audit cleaner FK (SET NULL preserved)", () => {
    const sql = readFileSync(path.join(MIGRATIONS_ROOT, PHASE_A_MIGRATION), "utf8");
    expect(sql).not.toMatch(/alter\s+table\s+public\.admin_operational_audit/i);
    expect(sql).toMatch(/admin_operational_audit\.cleaner_id remains ON DELETE SET NULL/i);
    expect(sql).not.toMatch(/deleted_at/i);
    expect(sql).not.toMatch(/suspended_at/i);
    expect(sql).not.toMatch(/create\s+or\s+replace\s+function/i);
  });

  it("documents SQL catalog checks for applied database", () => {
    const checksPath = path.join(TESTS_ROOT, PHASE_A_SQL_CHECKS);
    expect(existsSync(checksPath), `missing ${PHASE_A_SQL_CHECKS}`).toBe(true);

    const sql = readFileSync(checksPath, "utf8");
    expect(sql).toMatch(/cleaners_admin_delete policy must be dropped/i);
    expect(sql).toMatch(/assignment_offers\.cleaner_id FK delete_rule expected RESTRICT/i);
    expect(sql).toMatch(/earning_lines\.cleaner_id FK delete_rule expected RESTRICT/i);
  });

  it("base RLS migration historically defined cleaners_admin_delete (superseded by Phase A)", () => {
    const basePath = path.join(MIGRATIONS_ROOT, RLS_BASE_MIGRATION);
    const sql = readFileSync(basePath, "utf8");
    expect(sql).toMatch(/create\s+policy\s+cleaners_admin_delete/i);
  });
});
