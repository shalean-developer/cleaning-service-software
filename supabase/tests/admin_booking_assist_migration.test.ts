import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin_booking_assist migration (20260705100000)", () => {
  const sql = readFileSync(
    path.join(process.cwd(), "supabase/migrations/20260705100000_admin_booking_assist_audit.sql"),
    "utf8",
  );

  it("creates audit and idempotency tables with RLS enabled", () => {
    expect(sql).toContain("create table if not exists public.admin_booking_assist_audit");
    expect(sql).toContain("create table if not exists public.admin_booking_assist_idempotency");
    expect(sql).toContain(
      "alter table public.admin_booking_assist_audit enable row level security",
    );
    expect(sql).toContain(
      "alter table public.admin_booking_assist_idempotency enable row level security",
    );
  });

  it("grants admin select on audit only and service_role insert", () => {
    expect(sql).toContain("admin_booking_assist_audit_select_admin");
    expect(sql).toContain("grant insert on public.admin_booking_assist_audit to service_role");
    expect(sql).not.toMatch(
      /grant insert on public\.admin_booking_assist_audit to authenticated/,
    );
  });

  it("does not create public write policies on idempotency", () => {
    expect(sql).not.toContain("create policy");
    expect(sql).toMatch(/admin_booking_assist_idempotency enable row level security/);
    expect(sql).toContain("grant all on public.admin_booking_assist_idempotency to service_role");
  });
});
