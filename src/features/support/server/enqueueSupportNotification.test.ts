import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueSupportNotification } from "./enqueueSupportNotification";

vi.mock("./supportNotificationConfig", () => ({
  isSupportRequestNotificationsEnabled: () => false,
  isSupportAdminAlertsEnabled: () => false,
}));

describe("enqueueSupportNotification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not insert when customer notifications disabled", async () => {
    const insert = vi.fn();
    const client = {
      from: () => ({
        select: () => ({
          in: () => ({
            limit: async () => ({ data: [], error: null }),
          }),
        }),
        insert,
      }),
    };

    await enqueueSupportNotification(client as never, {
      event: "support_request_acknowledged",
      source: "booking_support",
      request: {
        id: "r1",
        booking_id: "b1",
        customer_id: "c1",
        user_id: null,
        request_type: "payment_help",
        status: "acknowledged",
        message: "help",
        preferred_new_time: null,
        customer_response: null,
        responded_at: null,
        admin_notes: null,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        resolved_at: null,
        resolved_by: null,
      },
      statusChangedAt: new Date().toISOString(),
      recipientEmail: "a@example.com",
    });

    expect(insert).not.toHaveBeenCalled();
  });
});
