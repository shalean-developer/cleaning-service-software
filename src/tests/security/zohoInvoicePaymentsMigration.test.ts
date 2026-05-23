import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260701140000_zoho_invoice_payments.sql";

describe("zoho_invoice_payments migration (static)", () => {
  it("creates isolated table, enum, indexes, and RLS", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations", MIGRATION);
    expect(existsSync(migrationPath), `missing ${MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create type public\.zoho_invoice_payment_status/i);
    expect(sql).toMatch(/create table if not exists public\.zoho_invoice_payments/i);
    expect(sql).toMatch(/constraint zoho_invoice_payments_idempotency_key_unique unique \(idempotency_key\)/i);
    expect(sql).toMatch(/constraint zoho_invoice_payments_paystack_reference_unique unique \(paystack_reference\)/i);
    expect(sql).toMatch(/zoho_invoice_payments_one_active_per_invoice/i);
    expect(sql).toMatch(/alter table public\.zoho_invoice_payments enable row level security/i);
    expect(sql).not.toMatch(/create policy/i);
  });
});
