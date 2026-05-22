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
    averageRating: null,
    primaryAreaLabel: "Cape Town",
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
  it("uses card rows with a fixed grid layout and no horizontal scroll wrapper", () => {
    const html = renderToStaticMarkup(<AdminCleanerListTable items={[sampleItem()]} />);
    expect(html).toContain("rounded-2xl border");
    expect(html).toContain("grid-cols-[minmax(0,28fr)_minmax(0,30fr)_minmax(0,18fr)_minmax(0,14fr)_minmax(0,10fr)]");
    expect(html).toContain("overflow-hidden");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("<table");
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

  it("renders only overview columns in the list header", () => {
    const html = renderToStaticMarkup(<AdminCleanerListTable items={[sampleItem()]} />);

    expect(html).toContain(">Name<");
    expect(html).toContain(">Email<");
    expect(html).toContain(">Phone<");
    expect(html).toContain(">State<");
    expect(html).toContain(">Active<");

    expect(html).not.toContain(">Suspended<");
    expect(html).not.toContain("Open offers");
    expect(html).not.toContain("Active bookings");
    expect(html).not.toContain("Pending earnings");
    expect(html).not.toContain("Last action");
    expect(html).not.toContain(">Offers<");
    expect(html).not.toContain(">Bookings<");
    expect(html).not.toContain(">Earnings<");
  });

  it("does not render operational count values removed from the list overview", () => {
    const html = renderToStaticMarkup(
      <AdminCleanerListTable
        items={[
          sampleItem({
            openOffersCount: 3,
            activeBookingsCount: 4,
            pendingEarningsCount: 5,
            isSuspended: true,
            lastLifecycleAction: {
              action: "suspended",
              outcome: "success",
              createdAt: "2026-05-17T10:00:00.000Z",
            },
          }),
        ]}
      />,
    );

    expect(html).not.toMatch(/>\s*3\s*</);
    expect(html).not.toMatch(/>\s*4\s*</);
    expect(html).not.toMatch(/>\s*5\s*</);
    expect(html).not.toContain("Suspended (success)");
  });
});
