import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("zoho monthly account billing phase 8 migration", () => {
  const sql = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260717100000_zoho_monthly_account_billing_phase8_delivery_automation.sql",
    ),
    "utf8",
  );

  it("creates monthly_account_collections_notes table", () => {
    expect(sql).toMatch(/create table if not exists public\.monthly_account_collections_notes/i);
    expect(sql).toMatch(/note_type in/i);
    expect(sql).toMatch(/finance_review/);
    expect(sql).toMatch(/dispute/);
  });

  it("extends audit actions for delivery automation", () => {
    expect(sql).toMatch(/monthly_invoice_auto_sent/i);
    expect(sql).toMatch(/monthly_invoice_auto_send_failed/i);
    expect(sql).toMatch(/monthly_invoice_reminder_scheduled/i);
    expect(sql).toMatch(/monthly_collections_note_added/i);
    expect(sql).toMatch(/monthly_invoice_dispute_requested/i);
  });
});
