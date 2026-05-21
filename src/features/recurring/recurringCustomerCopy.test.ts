import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CUSTOMER_RECURRING_FILES = [
  "src/app/(customer)/customer/bookings/recurring/page.tsx",
  "src/app/(customer)/customer/bookings/recurring/[seriesId]/page.tsx",
  "src/components/dashboard/customer/CustomerRecurringSeriesCard.tsx",
  "src/components/dashboard/customer/CustomerRecurringRequestActions.tsx",
];

const FORBIDDEN = ["auto-charge", "subscription", "monthly invoice", "automatically billed"];
const REQUIRED_PHRASES = ["pay to confirm", "assigned after payment"];

describe("customer recurring UI copy", () => {
  for (const rel of CUSTOMER_RECURRING_FILES) {
    it(`${rel} avoids misleading billing language`, () => {
      const text = readFileSync(resolve(rel), "utf8").toLowerCase();
      for (const phrase of FORBIDDEN) {
        expect(text).not.toContain(phrase);
      }
    });
  }

  it("customer recurring surfaces include per-visit payment clarity", () => {
    const detail = readFileSync(
      resolve("src/app/(customer)/customer/bookings/recurring/[seriesId]/page.tsx"),
      "utf8",
    ).toLowerCase();
    const card = readFileSync(
      resolve("src/components/dashboard/customer/CustomerRecurringSeriesCard.tsx"),
      "utf8",
    ).toLowerCase();
    const combined = `${detail} ${card}`;
    for (const phrase of REQUIRED_PHRASES) {
      expect(combined).toContain(phrase);
    }
    expect(combined).toContain("ready for payment");
  });
});
