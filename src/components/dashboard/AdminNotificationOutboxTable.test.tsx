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

  it("does not show Requeue for live sent rows even with showRequeueActions", () => {
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

  it("renders dry-run badge and muted row styling", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable
        notifications={[
          {
            ...sampleRow,
            status: "sent",
            isDryRun: true,
            lastError:
              "dry_run_sent;template=payment_confirmed;bookingId=booking-abcdef12;recipientType=customer",
            statusNote: "Dry run · payment_confirmed",
            dryRun: {
              template: "payment_confirmed",
              bookingId: "booking-abcdef12",
              offerId: null,
              recipientType: "customer",
            },
          },
        ]}
        showBookingLink
      />,
    );
    expect(html).toContain("Dry run");
    expect(html).not.toContain("(dry run)");
    expect(html).toContain("bg-zinc-50/90");
  });

  it('shows "Requeue dry-run" for eligible dry-run sent rows', () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable
        notifications={[
          {
            ...sampleRow,
            status: "sent",
            canRequeue: true,
            isDryRun: true,
            lastError:
              "dry_run_sent;template=payment_confirmed;bookingId=booking-abcdef12;recipientType=customer",
            statusNote: "Dry run · payment_confirmed",
            dryRun: {
              template: "payment_confirmed",
              bookingId: "booking-abcdef12",
              offerId: null,
              recipientType: "customer",
            },
          },
        ]}
        showBookingLink
        showRequeueActions
      />,
    );
    expect(html).toContain("Requeue dry-run");
    expect(html).not.toContain("Requeue dry-run dry-run");
  });

  it("renders empty state", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationOutboxTable notifications={[]} showBookingLink />,
    );
    expect(html).toContain("No notification records match these filters.");
  });
});
