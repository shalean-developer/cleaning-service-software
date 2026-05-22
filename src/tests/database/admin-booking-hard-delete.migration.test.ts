import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("admin booking hard delete migration", () => {
  it("ships privileged admin_hard_delete_booking function for service_role", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260628130000_admin_booking_hard_delete.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/create or replace function public\.admin_hard_delete_booking/i);
    expect(sql).toMatch(/disable trigger booking_state_audit_append_only/i);
    expect(sql).not.toMatch(/delete from public\.admin_operational_audit/i);
    expect(sql).toMatch(/grant execute on function public\.admin_hard_delete_booking\(uuid\) to service_role/i);
  });

  it("fix migration preserves append-only admin_operational_audit", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260628140000_admin_booking_hard_delete_preserve_ops_audit.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/create or replace function public\.admin_hard_delete_booking/i);
    expect(sql).not.toMatch(/delete from public\.admin_operational_audit/i);
  });
});
