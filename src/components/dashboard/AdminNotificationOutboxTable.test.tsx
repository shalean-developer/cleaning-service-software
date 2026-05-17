import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

import { renderToStaticMarkup } from "react-dom/server";
import { AdminNotificationOutboxTable } from "./AdminNotificationOutboxTable";
import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";

const sampleRow: AdminNotificationOutboxEntry = {
  id: "outbox-1",
  template: "payment_confirmed",
  status: "failed",
  channel: "email",
  recipientType: "customer",
  bookingId: "booking-abcdef12",
  offerId: null,
  attemptCount: 2,
  nextRetryAt: null,
  createdAt: "2026-05-17T10:00:00.000Z",
  updatedAt: "2026-05-17T10:01:00.000Z",
  lastError: "Provider rejected [redacted]",
  statusNote: "Provider rejected [redacted]",
  isDryRun: false,
  dryRun: null,
  isDeliverable: true,
  canRequeue: false,
};

describe("AdminNotificationOutboxTable", () => {
  it("renders booking link when enabled without requeue actions", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable notifications={[sampleRow]} showBookingLink />,
    );
    expect(html).toContain("/admin/bookings/booking-abcdef12");
    expect(html).not.toContain("Requeue");
    expect(html).not.toContain("Resend");
  });

  it("does not show requeue on global table without showRequeueActions", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable
        notifications={[{ ...sampleRow, canRequeue: true }]}
        showBookingLink
      />,
    );
    expect(html).not.toContain("Requeue");
  });

  it("shows Requeue on global table when showRequeueActions and canRequeue", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable
        notifications={[{ ...sampleRow, canRequeue: true }]}
        showBookingLink
        showRequeueActions
      />,
    );
    expect(html).toContain("Requeue");
    expect(html).not.toContain("Resend");
  });

  it("does not show Requeue for sent rows even with showRequeueActions", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable
        notifications={[
          {
            ...sampleRow,
            status: "sent",
            canRequeue: false,
          },
        ]}
        showBookingLink
        showRequeueActions
      />,
    );
    expect(html).not.toContain("Requeue");
  });

  it("renders empty state", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable notifications={[]} showBookingLink />,
    );
    expect(html).toContain("No notification records match these filters.");
  });
});
