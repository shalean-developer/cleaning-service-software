import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_IMPORT_PATTERNS = [
  /finalizePaidBooking/,
  /executeBookingCommand/,
  /runPostPaymentAssignmentDispatch/,
  /from "@\/lib\/zoho\/customerPayments"/,
  /from "@\/features\/payments/,
  /auto.?suspend/i,
  /blockAssignment/i,
  /auto.?void/i,
  /write.?off/i,
];

const MONTHLY_BILLING_ROOT = path.join(process.cwd(), "src/features/monthly-billing");

function collectSourceFiles(dir: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...collectSourceFiles(full));
    else if (
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

describe("monthly billing phase 8 safety guards", () => {
  it("does not import forbidden lifecycle, payout, or enforcement modules", () => {
    const files = collectSourceFiles(MONTHLY_BILLING_ROOT);
    for (const file of files) {
      const relative = path.relative(MONTHLY_BILLING_ROOT, file).replace(/\\/g, "/");
      const content = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(content, `${relative} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("customer portal read model does not expose risk or collections internals", () => {
    const readModel = readFileSync(
      path.join(MONTHLY_BILLING_ROOT, "server/customerMonthlyInvoicesReadModel.ts"),
      "utf8",
    );
    expect(readModel).not.toMatch(/riskScore/);
    expect(readModel).not.toMatch(/collectionsState/);
    expect(readModel).not.toMatch(/collections_notes/);
    expect(readModel).toMatch(/agingBucket/);
    expect(readModel).toMatch(/isOverdue/);
  });

  it("customer panel does not expose risk scores or collections notes", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/customer/CustomerMonthlyInvoicesPanel.tsx"),
      "utf8",
    );
    expect(panel).not.toMatch(/riskScore/);
    expect(panel).not.toMatch(/collectionsState/);
    expect(panel).not.toMatch(/collections_notes/);
    expect(panel).toMatch(/customer-monthly-invoice-overdue-warning/);
  });
});
