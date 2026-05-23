import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260702100000_zoho_sales_sync.sql";

describe("zoho_sales_sync migration (static)", () => {
  it("creates sync table, indexes, unique constraint, and RLS", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations", MIGRATION);
    expect(existsSync(migrationPath), `missing ${MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table if not exists public\.zoho_sales_sync/i);
    expect(sql).toMatch(/constraint zoho_sales_sync_source_unique unique \(source_type, source_id\)/i);
    expect(sql).toMatch(/idx_zoho_sales_sync_sync_status/i);
    expect(sql).toMatch(/idx_zoho_sales_sync_booking_id/i);
    expect(sql).toMatch(/idx_zoho_sales_sync_invoice_number/i);
    expect(sql).toMatch(/idx_zoho_sales_sync_next_sync_attempt_at/i);
    expect(sql).toMatch(/alter table public\.zoho_sales_sync enable row level security/i);
    expect(sql).not.toMatch(/create policy/i);
  });
});
