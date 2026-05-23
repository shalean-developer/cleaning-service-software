import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260710100000_zoho_monthly_account_billing_phase1.sql",
);

describe("zoho monthly account billing phase 1 migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates customer_billing_accounts with required columns and constraints", () => {
    expect(sql).toMatch(/create table if not exists public\.customer_billing_accounts/i);
    expect(sql).toMatch(/customer_billing_accounts_customer_unique/i);
    expect(sql).toMatch(/customer_billing_accounts_billing_mode_valid/i);
    expect(sql).toMatch(/customer_billing_accounts_monthly_enabled_requires_approval/i);
    expect(sql).toMatch(/pay_now.*paystack_link.*offline_payment.*monthly_account/is);
  });

  it("creates customer_billing_account_audit append-only", () => {
    expect(sql).toMatch(/create table if not exists public\.customer_billing_account_audit/i);
    expect(sql).toMatch(/forbid_customer_billing_account_audit_mutation/i);
    expect(sql).toMatch(/monthly_account_enabled/i);
    expect(sql).toMatch(/billing_account_viewed/i);
  });

  it("creates monthly_invoice_batches with status and uniqueness constraints", () => {
    expect(sql).toMatch(/create table if not exists public\.monthly_invoice_batches/i);
    expect(sql).toMatch(/monthly_invoice_batches_customer_month_unique/i);
    expect(sql).toMatch(/monthly_invoice_batches_status_valid/i);
    expect(sql).toMatch(/monthly_invoice_batches_total_cents_nonnegative/i);
    expect(sql).toMatch(/monthly_invoice_batches_currency_zar/i);
  });

  it("creates monthly_invoice_batch_items with booking uniqueness", () => {
    expect(sql).toMatch(/create table if not exists public\.monthly_invoice_batch_items/i);
    expect(sql).toMatch(/monthly_invoice_batch_items_booking_unique/i);
    expect(sql).toMatch(/monthly_invoice_batch_items_status_valid/i);
    expect(sql).toMatch(/monthly_invoice_batch_items_amount_cents_positive/i);
  });

  it("adds required indexes", () => {
    expect(sql).toMatch(/idx_customer_billing_accounts_customer_id/i);
    expect(sql).toMatch(/idx_customer_billing_accounts_zoho_customer_id/i);
    expect(sql).toMatch(/idx_monthly_invoice_batches_customer_billing_month/i);
    expect(sql).toMatch(/idx_monthly_invoice_batches_status/i);
    expect(sql).toMatch(/idx_monthly_invoice_batch_items_batch_id/i);
    expect(sql).toMatch(/idx_monthly_invoice_batch_items_booking_id/i);
    expect(sql).toMatch(/idx_monthly_invoice_batch_items_status/i);
  });

  it("enables RLS with admin select only and no customer write policies", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/customer_billing_accounts_select_admin/i);
    expect(sql).toMatch(/monthly_invoice_batches_select_admin/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
    expect(sql).not.toMatch(/for insert to authenticated/i);
    expect(sql).not.toMatch(/for update to authenticated/i);
    expect(sql).not.toMatch(/for delete to authenticated/i);
  });

  it("grants service_role write access", () => {
    expect(sql).toMatch(/grant insert, update, delete on public\.customer_billing_accounts to service_role/i);
    expect(sql).toMatch(/grant insert on public\.customer_billing_account_audit to service_role/i);
    expect(sql).toMatch(/grant insert, update, delete on public\.monthly_invoice_batches to service_role/i);
  });

  it("does not modify booking lifecycle tables", () => {
    expect(sql).not.toMatch(/alter table public\.bookings/i);
    expect(sql).not.toMatch(/finalizePaidBooking/i);
    expect(sql).not.toMatch(/CONFIRM_SERVICE_AUTHORIZED/i);
  });
});
