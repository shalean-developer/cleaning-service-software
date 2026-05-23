import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260711100000_zoho_monthly_account_billing_phase2_idempotency.sql",
);

describe("zoho monthly account billing phase 2 idempotency migration", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates customer_billing_account_idempotency", () => {
    expect(sql).toMatch(/create table if not exists public\.customer_billing_account_idempotency/i);
    expect(sql).toMatch(/idempotency_key text primary key/i);
    expect(sql).toMatch(/customer_billing_account_idempotency_action_valid/i);
  });

  it("enables RLS with admin select only", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/customer_billing_account_idempotency_select_admin/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
    expect(sql).not.toMatch(/for insert to authenticated/i);
  });

  it("grants insert to service_role only", () => {
    expect(sql).toMatch(/grant insert on public\.customer_billing_account_idempotency to service_role/i);
  });
});
