import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = "20260701200000_zoho_invoice_payment_cron_runs.sql";

describe("zoho_invoice_payment_cron_runs migration (static)", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase", "migrations", MIGRATION),
    "utf8",
  );

  it("creates cron run table with safe summary only", () => {
    expect(sql).toMatch(/create table if not exists public\.zoho_invoice_payment_cron_runs/i);
    expect(sql).toMatch(/job_name text not null/i);
    expect(sql).toMatch(/summary jsonb not null default/i);
    expect(sql).toMatch(
      /alter table public\.zoho_invoice_payment_cron_runs enable row level security/i,
    );
    expect(sql).not.toMatch(/create policy/i);
  });
});
