import { describe, expect, it } from "vitest";
import { isSupportRequestNotificationsEnabled } from "@/features/support/server/supportNotificationConfig";

/**
 * Booking support requests must never auto-execute booking lifecycle changes.
 */
describe("booking support request workflow contract", () => {
  it("customer route only calls customerCreateBookingSupportRequest", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile(
      "src/app/api/customer/bookings/[bookingId]/support-request/route.ts",
      "utf8",
    );
    expect(route).toContain("customerCreateBookingSupportRequest");
    expect(route).not.toContain("booking_apply_transition");
    expect(route).not.toContain("booking_finalize_payment");
    expect(route).not.toContain(".update(");
  });

  it("admin status route only updates support request status", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile(
      "src/app/api/admin/booking-support-requests/[requestId]/status/route.ts",
      "utf8",
    );
    expect(route).toContain("adminUpdateBookingSupportRequestStatus");
    expect(route).not.toContain("from(\"bookings\")");
  });

  it("service insert targets booking_support_requests only", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      "src/features/bookings/server/bookingSupportRequestsService.ts",
      "utf8",
    );
    expect(source).toContain('from("booking_support_requests")');
    expect(source).not.toMatch(/from\("bookings"\)\s*\.update/);
  });

  it("migration defines booking_support_requests workflow", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile(
      "supabase/migrations/20260624120000_booking_support_requests.sql",
      "utf8",
    );
    expect(sql).toContain("booking_support_requests");
    expect(sql).toContain("'open'");
    expect(sql).toContain("'acknowledged'");
    expect(sql).toContain("'resolved'");
    expect(sql).toContain("'rejected'");
    expect(sql).toContain("auth_customer_id()");
    expect(sql).toContain("auth_is_admin()");
  });

  it("notifications stay disabled by default feature flag", () => {
    expect(isSupportRequestNotificationsEnabled()).toBe(false);
  });

  it("status route accepts customerResponse without booking mutation", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile(
      "src/app/api/admin/booking-support-requests/[requestId]/status/route.ts",
      "utf8",
    );
    expect(route).toContain("customerResponse");
    expect(route).not.toContain('from("bookings")');
  });

  it("support notification templates avoid misleading booking copy", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      "src/features/support/server/supportNotificationTemplates.ts",
      "utf8",
    );
    expect(source).toContain("assertNoMisleadingBookingMutationCopy");
    expect(source).toContain("does not automatically cancel your booking");
  });

  it("customer booking detail includes support panel", async () => {
    const fs = await import("node:fs/promises");
    const page = await fs.readFile(
      "src/app/(customer)/customer/bookings/[bookingId]/page.tsx",
      "utf8",
    );
    expect(page).toContain("CustomerBookingSupportPanel");
    expect(page).toContain("searchParams");
    expect(page).toContain("supportQuery");
  });

  it("admin booking detail shows support requests panel", async () => {
    const fs = await import("node:fs/promises");
    const page = await fs.readFile(
      "src/app/(admin)/admin/bookings/[bookingId]/page.tsx",
      "utf8",
    );
    expect(page).toContain("AdminBookingSupportRequestsPanel");
  });

  it("hub quick actions use customerHubSupportQuickLinks", async () => {
    const fs = await import("node:fs/promises");
    const home = await fs.readFile(
      "src/components/dashboard/customer/CustomerHomeContent.tsx",
      "utf8",
    );
    const upcoming = await fs.readFile(
      "src/components/dashboard/customer/CustomerHomeUpcomingCard.tsx",
      "utf8",
    );
    expect(home).toContain("customerHubSupportQuickLinks");
    expect(upcoming).toContain("customerHubSupportQuickLinks");
    expect(upcoming).toContain("supportLinks.message");
  });

  it("admin support inbox page exists", async () => {
    const fs = await import("node:fs/promises");
    const page = await fs.readFile("src/app/(admin)/admin/support/page.tsx", "utf8");
    expect(page).toContain("AdminSupportInboxList");
    expect(page).toContain("listAdminSupportInbox");
  });

  it("does not create a public /help route", async () => {
    const fs = await import("node:fs/promises");
    const routes = await fs.readFile(
      "src/features/marketing/marketing-routes.ts",
      "utf8",
    );
    expect(routes).not.toContain("/help");
  });
});
