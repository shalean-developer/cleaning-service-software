import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: vi.fn(),
}));

vi.mock("@/features/bookings/server/commands/executeBookingCommand", () => ({
  executeBookingCommand: vi.fn(),
}));

vi.mock("@/features/support/server/recordSupportRequestAudit", () => ({
  recordBookingSupportRequestAudit: vi.fn(async () => {}),
}));

vi.mock("@/features/support/server/enqueueSupportNotification", () => ({
  enqueueSupportNotification: vi.fn(async () => {}),
  mapStatusToNotificationEvent: vi.fn(() => "support_request_resolved"),
  voidEnqueueSupportNotification: vi.fn(),
}));

vi.mock("@/features/notifications/server/resolveCustomerEmailOrNull", () => ({
  resolveCustomerEmailOrNull: vi.fn(async () => "c@example.com"),
}));

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { executeApprovedBookingRescheduleRequest } from "./executeApprovedBookingRescheduleRequest";

const adminUser: CurrentUser = {
  profileId: "admin-profile",
  role: "admin",
  email: "admin@test.com",
};

function futureIso(h: number) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

function mockSupabase(rows: {
  request: Record<string, unknown>;
  booking: Record<string, unknown>;
}) {
  const client = {
    from: vi.fn((table: string) => {
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        maybeSingle: vi.fn(async () => {
          if (table === "booking_support_requests") {
            return { data: rows.request, error: null };
          }
          if (table === "bookings") {
            return { data: rows.booking, error: null };
          }
          return { data: null, error: null };
        }),
        single: vi.fn(async () => {
          if (table === "booking_support_requests") {
            return {
              data: { ...rows.request, status: "resolved", customer_response: "Done." },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
      return chain;
    }),
  };
  vi.mocked(createServiceRoleClient).mockReturnValue(client as never);
  return client;
}

describe("executeApprovedBookingRescheduleRequest", () => {
  it("requires admin", async () => {
    const result = await executeApprovedBookingRescheduleRequest(
      { ...adminUser, role: "customer" },
      {
        supportRequestId: "req-1",
        newScheduledStart: futureIso(48),
        newScheduledEnd: futureIso(51),
        assignmentHandling: "block_if_unavailable",
        confirm: true,
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });

  it("requires confirm true", async () => {
    const result = await executeApprovedBookingRescheduleRequest(adminUser, {
      supportRequestId: "req-1",
      newScheduledStart: futureIso(48),
      newScheduledEnd: futureIso(51),
      assignmentHandling: "block_if_unavailable",
      confirm: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CONFIRMATION_REQUIRED");
  });

  it("executes valid reschedule and resolves request", async () => {
    mockSupabase({
      request: {
        id: "req-1",
        booking_id: "book-1",
        customer_id: "cust-1",
        request_type: "reschedule",
        status: "acknowledged",
        message: "Please move",
        preferred_new_time: futureIso(72),
        customer_response: null,
        responded_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolved_at: null,
        metadata: {},
      },
      booking: {
        id: "book-1",
        status: "assigned",
        series_id: null,
        scheduled_start: futureIso(48),
        scheduled_end: futureIso(51),
        cleaner_id: "cleaner-1",
        customer_id: "cust-1",
        metadata: {
          supportRescheduleExecution: { assignmentOutcome: "retained" },
        },
      },
    });
    vi.mocked(createBookingCommandBackend).mockReturnValue({} as never);
    vi.mocked(executeBookingCommand).mockResolvedValue({
      ok: true,
      bookingId: "book-1",
      status: "assigned",
      idempotent: false,
    });

    const result = await executeApprovedBookingRescheduleRequest(adminUser, {
      supportRequestId: "req-1",
      newScheduledStart: futureIso(96),
      newScheduledEnd: futureIso(99),
      assignmentHandling: "keep_if_available",
      confirm: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assignmentOutcome).toBe("retained");
    expect(result.supportRequest.status).toBe("resolved");
    expect(executeBookingCommand).toHaveBeenCalled();
  });
});
