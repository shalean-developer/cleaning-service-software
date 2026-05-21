import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CUSTOMER_RECURRING_FILES = [
  "src/app/(customer)/customer/bookings/recurring/page.tsx",
  "src/app/(customer)/customer/bookings/recurring/[seriesId]/page.tsx",
  "src/app/(customer)/customer/bookings/recurring/groups/[groupId]/page.tsx",
  "src/components/dashboard/customer/CustomerRecurringSeriesCard.tsx",
  "src/components/dashboard/customer/CustomerRecurringScheduleGroupCard.tsx",
  "src/components/dashboard/customer/CustomerRecurringRequestActions.tsx",
  "src/components/dashboard/customer/CustomerRecurringGroupRequestActions.tsx",
  "src/components/dashboard/customer/CustomerRecurringGroupVisitsPanel.tsx",
];

const FORBIDDEN = [
  "auto-charge",
  "subscription",
  "monthly invoice",
  "automatically billed",
  "guaranteed same cleaner",
];
const REQUIRED_PHRASES = [
  "pay to confirm",
  "assigned after payment",
  "paid individually",
  "request",
];

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
    const group = readFileSync(
      resolve("src/app/(customer)/customer/bookings/recurring/groups/[groupId]/page.tsx"),
      "utf8",
    ).toLowerCase();
    const visits = readFileSync(
      resolve("src/components/dashboard/customer/CustomerRecurringGroupVisitsPanel.tsx"),
      "utf8",
    ).toLowerCase();
    const combined = `${detail} ${group} ${visits}`;
    for (const phrase of REQUIRED_PHRASES) {
      expect(combined).toContain(phrase);
    }
    expect(combined).toContain("each recurring visit is paid individually");
  });
});
