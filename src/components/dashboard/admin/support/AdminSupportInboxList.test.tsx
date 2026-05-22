import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
import type { AdminSupportInboxItem } from "@/features/support/server/adminSupportInboxReadModel";
import {
  AdminSupportInboxList,
  AdminSupportInboxTriageBanner,
} from "./AdminSupportInboxList";

const bookingItem: AdminSupportInboxItem = {
  id: "bsr-1",
  source: "booking_support",
  requestType: "reschedule",
  requestTypeLabel: "Request reschedule",
  status: "open",
  statusLabel: "Open",
  priority: "urgent",
  messagePreview: "Need a new time",
  preferredNewTime: "2026-06-01T10:00:00.000Z",
  createdAt: "2026-05-20T10:00:00.000Z",
  resolvedAt: null,
  customerId: "cust-1",
  customerName: "Jane Doe",
  customerEmail: null,
  customerPhone: "+27821234567",
  bookingId: "book-1",
  bookingReference: "BOOK1234",
  bookingStatus: "confirmed",
  paymentStatus: "paid",
  scheduledStart: "2026-05-25T08:00:00.000Z",
  serviceLabel: "Standard clean",
  addressSummary: "Sea Point, Cape Town",
  seriesId: null,
  groupId: null,
  frequencyLabel: null,
  targetWeekdayLabel: null,
  bookingHref: "/admin/bookings/book-1",
  seriesHref: null,
  groupHref: null,
  suggestedNextAction: "Open the booking and reschedule.",
  canAcknowledge: true,
  canResolve: true,
  canReject: true,
  staleOpen24h: false,
  staleAcknowledged48h: false,
  updatedAt: "2026-05-20T10:00:00.000Z",
  slaCategory: "urgent",
  slaStatus: "healthy",
  ageBucket: "over_48h",
  ageMinutes: 3000,
  firstResponseDueAt: null,
  resolutionDueAt: null,
  timeToFirstResponseMinutes: null,
  timeToResolutionMinutes: null,
  urgencyReason: null,
  triageLabel: "awaiting_ops_action",
  escalationReasons: [],
  cleanerId: null,
  cleanerLabel: null,
  suburb: "Sea Point",
  paymentRisk: false,
  upcomingVisitHours: 48,
  customerResponse: null,
  respondedAt: null,
  adminNotes: null,
  resolvedBy: null,
};

const recurringItem: AdminSupportInboxItem = {
  ...bookingItem,
  id: "rsr-1",
  source: "recurring_support",
  requestType: "pause_group",
  requestTypeLabel: "Pause entire schedule",
  bookingId: null,
  bookingReference: null,
  bookingHref: null,
  seriesId: "series-1",
  groupId: "group-1",
  seriesHref: "/admin/recurring/series-1",
  groupHref: "/admin/recurring/groups/group-1",
  frequencyLabel: "Weekly",
  targetWeekdayLabel: "Mon",
};

describe("AdminSupportInboxList", () => {
  it("renders empty state", () => {
    const html = renderToStaticMarkup(<AdminSupportInboxList items={[]} />);
    expect(html).toContain("No support requests match this filter");
  });

  it("renders open request with source and priority badges", () => {
    const html = renderToStaticMarkup(<AdminSupportInboxList items={[bookingItem]} />);
    expect(html).toContain("One-off booking");
    expect(html).toContain("urgent");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Ref BOOK1234");
    expect(html).toContain("Acknowledge");
    expect(html).toContain('href="/admin/bookings/book-1"');
  });

  it("renders recurring source badge and group link", () => {
    const html = renderToStaticMarkup(<AdminSupportInboxList items={[recurringItem]} />);
    expect(html).toContain("Recurring");
    expect(html).toContain('href="/admin/recurring/groups/group-1"');
    expect(html).toContain("Open schedule group");
  });

  it("shows triage notice banner", () => {
    const html = renderToStaticMarkup(<AdminSupportInboxTriageBanner />);
    expect(html).toContain("does not automatically change bookings");
  });
});
