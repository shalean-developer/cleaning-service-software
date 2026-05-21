import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES = [
  "src/app/(customer)/customer/bookings/recurring/page.tsx",
  "src/app/(customer)/customer/bookings/recurring/groups/[groupId]/page.tsx",
  "src/app/(customer)/customer/bookings/recurring/[seriesId]/page.tsx",
  "src/app/(admin)/admin/recurring/page.tsx",
  "src/app/(admin)/admin/recurring/groups/[groupId]/page.tsx",
  "src/app/api/customer/recurring/groups/[groupId]/request/route.ts",
  "src/app/api/admin/recurring/requests/[requestId]/resolve/route.ts",
];

const LINK_SNIPPETS = [
  { file: "src/components/dashboard/customer/CustomerRecurringScheduleGroupCard.tsx", href: "/customer/bookings/recurring/groups/" },
  { file: "src/components/dashboard/customer/CustomerRecurringGroupWeekdayPanel.tsx", href: "seriesDetailHref" },
  { file: "src/components/dashboard/admin/recurring/AdminRecurringScheduleGroupCard.tsx", href: "/admin/recurring/groups/" },
  { file: "src/app/(admin)/admin/recurring/groups/[groupId]/page.tsx", href: "/admin/recurring/health" },
];

describe("recurring group route wiring", () => {
  for (const rel of ROUTES) {
    it(`route file exists: ${rel}`, () => {
      expect(existsSync(resolve(rel))).toBe(true);
    });
  }

  for (const { file, href } of LINK_SNIPPETS) {
    it(`${file} links to ${href}`, () => {
      const text = readFileSync(resolve(file), "utf8");
      expect(text).toContain(href);
    });
  }

  it("customer group request API does not mutate series directly", () => {
    const text = readFileSync(
      resolve("src/app/api/customer/recurring/groups/[groupId]/request/route.ts"),
      "utf8",
    );
    expect(text).toContain("customerRequestRecurringGroupChange");
    expect(text).not.toContain("pauseBookingSeries");
    expect(text).not.toContain("updateScheduleGroupStatus");
  });
});
