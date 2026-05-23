import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin monthly billing generate invoice API route", () => {
  it("POST only with admin auth and confirmReviewed validation", () => {
    const route = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/admin/monthly-billing/batches/[batchId]/generate-zoho-invoice/route.ts",
      ),
      "utf8",
    );
    expect(route).toMatch(/export async function POST/);
    expect(route).not.toMatch(/export async function GET/);
    expect(route).toMatch(/requireApiUser\(\["admin"\]\)/);
    expect(route).toMatch(/parseGenerateZohoMonthlyInvoiceBody/);
    expect(route).toMatch(/generateZohoMonthlyInvoice/);
  });
});
