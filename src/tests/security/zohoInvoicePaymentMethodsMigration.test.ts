import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260701170000_zoho_invoice_payment_methods.sql";

describe("zoho_invoice_payment_methods migration (static)", () => {
  it("creates table, indexes, unique constraints, and RLS without policies", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations", MIGRATION);
    expect(existsSync(migrationPath), `missing ${MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table if not exists public\.zoho_invoice_payment_methods/i);
    expect(sql).toMatch(/authorization_code text not null/i);
    expect(sql).toMatch(/constraint zoho_invoice_payment_methods_authorization_code_unique unique \(authorization_code\)/i);
    expect(sql).toMatch(/zoho_invoice_payment_methods_one_default_per_customer/i);
    expect(sql).toMatch(/alter table public\.zoho_invoice_payment_methods enable row level security/i);
    expect(sql).not.toMatch(/create policy/i);
  });
});
