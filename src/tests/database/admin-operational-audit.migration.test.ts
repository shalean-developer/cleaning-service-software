import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260518120000_admin_operational_audit.sql",
);

describe("admin_operational_audit migration (Stage 5B-1a)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("creates admin_operational_audit with required columns", () => {
    expect(sql).toMatch(/create table if not exists public\.admin_operational_audit/i);
    expect(sql).toMatch(/booking_id uuid not null/i);
    expect(sql).toMatch(/admin_profile_id uuid not null/i);
    expect(sql).toMatch(/action text not null/i);
    expect(sql).toMatch(/outcome text not null/i);
    expect(sql).toMatch(/metadata jsonb not null default/i);
  });

  it("constrains action and outcome values", () => {
    expect(sql).toMatch(/assignment_recovery/i);
    expect(sql).toMatch(/manual_dispatch_offer/i);
    expect(sql).toMatch(/replace_open_offer/i);
    expect(sql).toMatch(/'success', 'idempotent', 'rejected', 'failed'/i);
  });

  it("adds booking and admin indexes", () => {
    expect(sql).toMatch(/idx_admin_operational_audit_booking_created/i);
    expect(sql).toMatch(/idx_admin_operational_audit_admin_created/i);
    expect(sql).toMatch(/idx_admin_operational_audit_action_created/i);
  });

  it("adds partial unique idempotency index for success and idempotent", () => {
    expect(sql).toMatch(/admin_operational_audit_idempotency_unique/i);
    expect(sql).toMatch(/outcome in \('success', 'idempotent'\)/i);
  });

  it("enables append-only trigger", () => {
    expect(sql).toMatch(/forbid_admin_operational_audit_mutation/i);
    expect(sql).toMatch(/admin_operational_audit_append_only/i);
  });

  it("enables RLS with admin select only", () => {
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/admin_operational_audit_select_admin/i);
    expect(sql).toMatch(/auth_is_admin\(\)/i);
    expect(sql).not.toMatch(/for insert to authenticated/i);
    expect(sql).not.toMatch(/for update to authenticated/i);
    expect(sql).not.toMatch(/for delete to authenticated/i);
  });

  it("grants insert to service_role only", () => {
    expect(sql).toMatch(/grant insert on public\.admin_operational_audit to service_role/i);
  });

  it("does not modify booking_state_audit", () => {
    expect(sql).not.toMatch(/alter table public\.booking_state_audit/i);
  });
});
