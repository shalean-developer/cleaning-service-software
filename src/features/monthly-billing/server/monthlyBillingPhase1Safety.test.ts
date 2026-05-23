import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_IMPORTS = [
  "finalizePaidBooking",
  "runBookingCommand",
  "CONFIRM_SERVICE_AUTHORIZED",
  "syncShaleanSaleToZoho",
  "createZohoInvoice",
  "adminManualDispatchOffer",
  "runPostPaymentAssignmentDispatch",
];

const MONTHLY_BILLING_ROOT = path.join(process.cwd(), "src/features/monthly-billing");

function collectTsFiles(dir: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if ((name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

describe("monthly billing phase 1 safety guards", () => {
  it("does not import lifecycle, payout, or zoho invoice creation modules", () => {
    const files = collectTsFiles(MONTHLY_BILLING_ROOT);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(content, `${path.relative(process.cwd(), file)} must not reference ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });
});
