import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260518190000_admin_operational_audit_notification_requeue.sql",
);

describe("admin_operational_audit notification_requeue migration (Stage 5E-1a)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("extends action check with notification_requeue", () => {
    expect(sql).toMatch(/notification_requeue/i);
    expect(sql).toMatch(/admin_operational_audit_action_check/i);
    expect(sql).toMatch(/assignment_recovery/i);
    expect(sql).toMatch(/manual_dispatch_offer/i);
    expect(sql).toMatch(/replace_open_offer/i);
  });

  it("does not change RLS or append-only behavior", () => {
    expect(sql).not.toMatch(/row level security/i);
    expect(sql).not.toMatch(/forbid_admin_operational_audit_mutation/i);
    expect(sql).not.toMatch(/delete from public\.admin_operational_audit/i);
  });
});
