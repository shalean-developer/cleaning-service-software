import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260701190000_zoho_invoice_payment_method_management.sql";

describe("zoho_invoice_payment_method_management migration (static)", () => {
  it("adds management columns, audit table, indexes, and RLS without policies", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations", MIGRATION);
    expect(existsSync(migrationPath), `missing ${MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/revoke_reason text/i);
    expect(sql).toMatch(/revocation_source text/i);
    expect(sql).toMatch(/last_used_at timestamptz/i);
    expect(sql).toMatch(/create table if not exists public\.zoho_invoice_payment_method_audit/i);
    expect(sql).toMatch(/idx_zoho_invoice_payment_method_audit_payment_method_id/i);
    expect(sql).toMatch(
      /alter table public\.zoho_invoice_payment_method_audit enable row level security/i,
    );
    expect(sql).not.toMatch(/create policy/i);
  });
});
