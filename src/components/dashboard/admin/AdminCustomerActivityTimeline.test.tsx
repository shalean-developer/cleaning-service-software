import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readTimelineSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/components/dashboard/admin/AdminCustomerActivityTimeline.tsx"),
    "utf8",
  );
}

function readDetailSectionsSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/components/dashboard/admin/AdminCustomerDetailSections.tsx"),
    "utf8",
  );
}

describe("AdminCustomerActivityTimeline", () => {
  it("renders empty state copy", () => {
    const source = readTimelineSource();
    expect(source).toContain("No customer activity recorded yet");
  });

  it("groups events by day and shows source badges", () => {
    const source = readTimelineSource();
    expect(source).toContain("groupEventsByDay");
    expect(source).toContain("SOURCE_STYLES");
    expect(source).toContain("View booking");
    expect(source).toContain("event.bookingHref");
  });
});

describe("AdminCustomerDetailSections", () => {
  it("includes summary cards, contact, health, and timeline", () => {
    const source = readDetailSectionsSource();
    expect(source).toContain("SummaryCard");
    expect(source).toContain("Contact");
    expect(source).toContain("Domain health");
    expect(source).toContain("Customer activity timeline");
    expect(source).toContain("AdminCustomerActivityTimeline");
  });

  it("includes booking operations panel, filters, and deferred create booking", () => {
    const source = readDetailSectionsSource();
    expect(source).toContain("Customer booking operations");
    expect(source).toContain("AdminCustomerBookingFilters");
    expect(source).toContain("AdminCustomerBookingCard");
    expect(source).toContain("Payment support summary");
    expect(source).toContain("customer_id ownership");
    expect(source).toContain("ADMIN_CUSTOMER_ASSISTED_BOOKING_SUPPORTED");
    expect(source).toContain("ADMIN_CUSTOMER_ASSISTED_BOOKING_DEFERRED_MESSAGE");
    expect(source).not.toContain("mark-paid");
    expect(source).not.toContain("reassign");
  });
});
