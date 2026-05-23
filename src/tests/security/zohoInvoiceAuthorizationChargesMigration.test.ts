import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260701180000_zoho_invoice_authorization_charges.sql";

describe("zoho_invoice_authorization_charges migration (static)", () => {
  it("creates tables, indexes, unique constraints, and RLS without policies", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations", MIGRATION);
    expect(existsSync(migrationPath), `missing ${MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table if not exists public\.zoho_invoice_authorization_charges/i);
    expect(sql).toMatch(
      /create table if not exists public\.zoho_invoice_authorization_charge_events/i,
    );
    expect(sql).toMatch(/constraint zoho_invoice_authorization_charges_paystack_reference_unique/i);
    expect(sql).toMatch(/zoho_invoice_authorization_charges_one_active_per_invoice/i);
    expect(sql).toMatch(
      /alter table public\.zoho_invoice_authorization_charges enable row level security/i,
    );
    expect(sql).not.toMatch(/create policy/i);
  });
});
