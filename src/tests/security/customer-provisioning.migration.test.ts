import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/20260517160000_stage1c_customer_auto_provisioning.sql",
);

describe("customer auto-provisioning migration (Stage 1C-2)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("defines provision_customer_for_profile as security definer", () => {
    expect(sql).toMatch(/create or replace function public\.provision_customer_for_profile/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/role is distinct from 'customer'/i);
    expect(sql).toMatch(/on conflict \(profile_id\) do nothing/i);
  });

  it("provisions only on customer profile insert via trigger", () => {
    expect(sql).toMatch(/after insert on public\.profiles/i);
    expect(sql).toMatch(/new\.role = 'customer'/i);
    expect(sql).not.toMatch(/after update on public\.profiles/i);
  });

  it("does not reference cleaners, bookings, or payments", () => {
    expect(sql).not.toMatch(/public\.cleaners/i);
    expect(sql).not.toMatch(/public\.bookings/i);
    expect(sql).not.toMatch(/public\.payments/i);
    expect(sql).not.toMatch(/assignment_offers/i);
    expect(sql).not.toMatch(/earning_lines/i);
  });

  it("includes idempotent backfill for customer profiles only", () => {
    expect(sql).toMatch(/p\.role = 'customer'/i);
    expect(sql).toMatch(/c\.id is null/i);
  });
});
