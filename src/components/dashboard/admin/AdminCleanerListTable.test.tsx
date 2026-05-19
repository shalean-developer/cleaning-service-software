import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AdminCleanerListTable,
  formatCleanerDisplayName,
  truncateCleanerCellText,
} from "./AdminCleanerListTable";
import type { AdminCleanerListItem } from "@/features/cleaners/server/admin/types";

function sampleItem(overrides: Partial<AdminCleanerListItem> = {}): AdminCleanerListItem {
  return {
    id: "cleaner-1",
    name: "Ada Cleaner",
    email: "ada@example.com",
    phone: "+27 82 000 0000",
    operationalState: "onboarding",
    active: true,
    isSuspended: false,
    openOffersCount: 0,
    activeBookingsCount: 1,
    pendingEarningsCount: 2,
    lastLifecycleAction: {
      action: "suspended",
      outcome: "success",
      createdAt: "2026-05-17T10:00:00.000Z",
    },
    ...overrides,
  };
}

describe("formatCleanerDisplayName", () => {
  it("shortens embedded UUIDs in long generated names", () => {
    const uuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const { display, full } = formatCleanerDisplayName(`Lifecycle seed ${uuid}`);
    expect(full).toContain(uuid);
    expect(display).toBe("Lifecycle seed a1b2c3d4…");
  });

  it("truncates very long names without UUIDs", () => {
    const longName = "X".repeat(80);
    const { display, full } = formatCleanerDisplayName(longName);
    expect(full).toBe(longName);
    expect(display.endsWith("…")).toBe(true);
    expect(display.length).toBeLessThan(full.length);
  });
});

describe("AdminCleanerListTable", () => {
  it("uses fixed table layout without horizontal scroll wrapper", () => {
    const html = renderToStaticMarkup(<AdminCleanerListTable items={[sampleItem()]} />);
    expect(html).toContain("table-fixed");
    expect(html).toContain("overflow-hidden");
    expect(html).not.toContain("overflow-x-auto");
  });

  it("truncates long contact fields and preserves full values in title", () => {
    const longEmail = `${"a".repeat(70)}@example.com`;
    const longPhone = `+27${"9".repeat(40)}`;
    const html = renderToStaticMarkup(
      <AdminCleanerListTable
        items={[
          sampleItem({
            name: "Test Cleaner",
            email: longEmail,
            phone: longPhone,
          }),
        ]}
      />,
    );

    expect(html).toContain(`title="${longEmail}"`);
    expect(html).toContain(`title="${longPhone}"`);
    expect(html).toContain("truncate");
    expect(html).toContain(truncateCleanerCellText(longEmail));
    expect(html).toContain(truncateCleanerCellText(longPhone));
    expect(html).not.toMatch(new RegExp(`>${longEmail}<`));
    expect(html).not.toMatch(new RegExp(`>${longPhone}<`));
  });

  it("keeps operational state badge label on one line", () => {
    const html = renderToStaticMarkup(
      <AdminCleanerListTable items={[sampleItem({ operationalState: "onboarding" })]} />,
    );
    expect(html).toContain("Onboarding");
    expect(html).toContain("whitespace-nowrap");
    expect(html).toContain("[overflow-wrap:normal]");
  });

  it("preserves cleaner detail links", () => {
    const html = renderToStaticMarkup(
      <AdminCleanerListTable items={[sampleItem({ id: "cleaner-abc" })]} />,
    );
    expect(html).toContain('href="/admin/cleaners/cleaner-abc"');
  });
});
