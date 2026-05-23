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

const ALLOWED_INVOICES_IMPORT = "server/syncZohoMonthlyInvoicePaymentStatus.ts";

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

describe("monthly billing phase 7 safety guards", () => {
  it("does not import forbidden lifecycle or payment modules", () => {
    const files = collectSourceFiles(MONTHLY_BILLING_ROOT);
    for (const file of files) {
      const relative = path.relative(MONTHLY_BILLING_ROOT, file).replace(/\\/g, "/");
      const content = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(content, `${relative} matched ${pattern}`).not.toMatch(pattern);
      }
      if (relative !== ALLOWED_INVOICES_IMPORT) {
        expect(content, `${relative} must not import @/lib/zoho/invoices`).not.toMatch(
          /from "@\/lib\/zoho\/invoices"/,
        );
      }
    }
  });
});
