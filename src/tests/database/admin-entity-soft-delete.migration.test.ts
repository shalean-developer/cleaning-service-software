import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("admin entity soft delete migration", () => {
  it("adds soft-delete columns and admin_delete_audit", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260628120000_admin_entity_soft_delete.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/bookings[\s\S]*deleted_at timestamptz/i);
    expect(sql).toMatch(/customers[\s\S]*deleted_at timestamptz/i);
    expect(sql).toMatch(/create table if not exists public\.admin_delete_audit/i);
    expect(sql).toMatch(/admin_delete_audit_append_only/i);
  });
});
