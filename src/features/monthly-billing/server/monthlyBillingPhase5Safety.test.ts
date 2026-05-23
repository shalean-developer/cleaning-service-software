import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_IMPORT_PATTERNS = [
  /finalizePaidBooking/,
  /executeBookingCommand/,
  /runPostPaymentAssignmentDispatch/,
  /from "@\/lib\/zoho\/customerPayments"/,
  /from "@\/features\/payments/,
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

describe("monthly billing phase 5 safety guards", () => {
  it("does not import forbidden lifecycle or payment modules", () => {
    const files = collectSourceFiles(MONTHLY_BILLING_ROOT);
    for (const file: string of files) {
      const content = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(content, `${path.relative(process.cwd(), file)} matched ${pattern}`).not.toMatch(
          pattern,
        );
      }
    }
  });

  it("uses monthlyInvoices helper instead of mark sent on create", () => {
    const facade = readFileSync(
      path.join(MONTHLY_BILLING_ROOT, "server/generateZohoMonthlyInvoiceFacade.ts"),
      "utf8",
    );
    expect(facade).toMatch(/createZohoMonthlyInvoice/);
    expect(facade).not.toMatch(/markZohoInvoiceSent/);
    expect(facade).not.toMatch(/createZohoCustomerPayment/);
  });
});
