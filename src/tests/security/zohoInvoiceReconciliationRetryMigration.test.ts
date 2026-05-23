import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260701160000_zoho_invoice_reconciliation_retry_fields.sql";

describe("zoho invoice reconciliation retry fields migration (static)", () => {
  it("adds retry columns and indexes", () => {
    const migrationPath = path.join(process.cwd(), "supabase/migrations", MIGRATION);
    expect(existsSync(migrationPath), `missing ${MIGRATION}`).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/add column if not exists reconcile_attempts integer not null default 0/i);
    expect(sql).toMatch(/add column if not exists last_reconcile_attempt_at timestamptz/i);
    expect(sql).toMatch(/add column if not exists next_reconcile_attempt_at timestamptz/i);
    expect(sql).toMatch(/add column if not exists last_reconcile_error text/i);
    expect(sql).toMatch(/idx_zoho_invoice_payments_next_reconcile_attempt_at/i);
    expect(sql).toMatch(/idx_zoho_invoice_payments_reconcile_pending/i);
  });
});
