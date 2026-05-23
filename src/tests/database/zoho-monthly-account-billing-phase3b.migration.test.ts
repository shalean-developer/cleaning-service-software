import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260712100000_zoho_monthly_account_billing_phase3b_service_authorization.sql",
);

describe("zoho monthly account billing phase 3b migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates monthly_service_authorizations with required constraints", () => {
    expect(sql).toMatch(/create table if not exists public\.monthly_service_authorizations/i);
    expect(sql).toMatch(/monthly_service_authorizations_booking_unique/i);
    expect(sql).toMatch(/monthly_service_authorizations_idempotency_unique/i);
    expect(sql).toMatch(/monthly_service_authorizations_status_valid/i);
    expect(sql).toMatch(/authorized.*revoked/is);
  });

  it("extends billing account audit with monthly_service_authorized", () => {
    expect(sql).toMatch(/monthly_service_authorized/i);
  });

  it("enables admin select RLS and service_role writes", () => {
    expect(sql).toMatch(/monthly_service_authorizations_select_admin/i);
    expect(sql).toMatch(/grant insert, update on public\.monthly_service_authorizations to service_role/i);
  });

  it("does not modify payment or invoice tables", () => {
    expect(sql).not.toMatch(/alter table public\.payments/i);
    expect(sql).not.toMatch(/monthly_invoice_batches/i);
    expect(sql).not.toMatch(/finalizePaidBooking/i);
  });
});
