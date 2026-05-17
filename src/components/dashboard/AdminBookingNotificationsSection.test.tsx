import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingNotificationsSection } from "./AdminBookingNotificationsSection";
import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";

const sampleRow: AdminNotificationOutboxEntry = {
  id: "outbox-1",
  template: "payment_confirmed",
  status: "sent",
  channel: "email",
  recipientType: "customer",
  bookingId: "booking-1",
  offerId: null,
  attemptCount: 1,
  nextRetryAt: null,
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:01:00.000Z",
  lastError: null,
  statusNote: null,
  isDryRun: false,
  dryRun: null,
  isDeliverable: true,
  canRequeue: false,
};

describe("AdminBookingNotificationsSection", () => {
  it("renders empty state", () => {
    const html = renderToStaticMarkup(
      <AdminBookingNotificationsSection notifications={[]} />,
    );
    expect(html).toContain("No notification records for this booking yet.");
    expect(html).not.toContain("<table");
  });

  it("renders table rows without requeue for ineligible rows", () => {
    const html = renderToStaticMarkup(
      <AdminBookingNotificationsSection notifications={[sampleRow]} />,
    );
    expect(html).toContain("payment_confirmed");
    expect(html).toContain("sent");
    expect(html).toContain("email");
    expect(html).not.toContain("Requeue");
    expect(html).not.toContain("Resend");
  });

  it("shows Requeue for eligible failed rows", () => {
    const html = renderToStaticMarkup(
      <AdminBookingNotificationsSection
        notifications={[
          {
            ...sampleRow,
            status: "failed",
            canRequeue: true,
          },
        ]}
      />,
    );
    expect(html).toContain("Requeue");
    expect(html).not.toContain("Resend");
  });

  it("shows short offer id when present", () => {
    const html = renderToStaticMarkup(
      <AdminBookingNotificationsSection
        notifications={[
          {
            ...sampleRow,
            id: "outbox-2",
            template: "assignment_offer",
            channel: "push",
            offerId: "offer-abcdef12",
          },
        ]}
      />,
    );
    expect(html).toContain("offer-ab");
  });
});
