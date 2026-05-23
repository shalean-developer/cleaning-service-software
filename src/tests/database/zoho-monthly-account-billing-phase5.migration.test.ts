import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260714100000_zoho_monthly_account_billing_phase5_invoice_generation.sql",
);

describe("zoho monthly account billing phase 5 migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("extends audit actions for invoice generation", () => {
    expect(sql).toMatch(/monthly_invoice_generated/i);
    expect(sql).toMatch(/monthly_invoice_generation_failed/i);
  });

  it("allows monthly_invoice_generated idempotency action", () => {
    expect(sql).toMatch(/monthly_invoice_generated/i);
    expect(sql).toMatch(/customer_billing_account_idempotency_action_valid/i);
  });

  it("does not modify payment tables or booking lifecycle", () => {
    expect(sql).not.toMatch(/alter table public\.payments/i);
    expect(sql).not.toMatch(/alter table public\.bookings/i);
  });
});
