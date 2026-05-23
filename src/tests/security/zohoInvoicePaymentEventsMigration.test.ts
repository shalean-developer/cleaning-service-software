import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EVENTS_MIGRATION = "20260701150000_zoho_invoice_payment_events.sql";

describe("zoho_invoice_payment_events migration (static)", () => {
  it("creates event table, indexes, and RLS without public policies", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations", EVENTS_MIGRATION);
    expect(existsSync(migrationPath), `missing ${EVENTS_MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table if not exists public\.zoho_invoice_payment_events/i);
    expect(sql).toMatch(
      /constraint zoho_invoice_payment_events_provider_event_id_unique unique \(provider_event_id\)/i,
    );
    expect(sql).toMatch(/references public\.zoho_invoice_payments \(id\) on delete cascade/i);
    expect(sql).toMatch(/alter table public\.zoho_invoice_payment_events enable row level security/i);
    expect(sql).not.toMatch(/create policy/i);
  });
});
