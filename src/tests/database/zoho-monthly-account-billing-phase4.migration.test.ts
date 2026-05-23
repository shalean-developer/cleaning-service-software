import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260713100000_zoho_monthly_account_billing_phase4_invoice_accrual.sql",
);

describe("zoho monthly account billing phase 4 migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("extends billing account audit with monthly_invoice_item_accrued", () => {
    expect(sql).toMatch(/monthly_invoice_item_accrued/i);
    expect(sql).toMatch(/customer_billing_account_audit_action_valid/i);
  });

  it("does not create Zoho invoice tables or payment mutations", () => {
    expect(sql).not.toMatch(/create table/i);
    expect(sql).not.toMatch(/alter table public\.payments/i);
    expect(sql).not.toMatch(/zoho_invoice/i);
  });
});
