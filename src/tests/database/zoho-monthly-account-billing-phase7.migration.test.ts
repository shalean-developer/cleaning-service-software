import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("zoho monthly account billing phase 7 migration", () => {
  const sql = readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20260716100000_zoho_monthly_account_billing_phase7_invoice_operations.sql",
    ),
    "utf8",
  );

  it("extends audit actions for invoice operations", () => {
    expect(sql).toMatch(/monthly_invoice_sent/i);
    expect(sql).toMatch(/monthly_invoice_reminder_sent/i);
    expect(sql).toMatch(/monthly_invoice_marked_overdue/i);
  });
});
