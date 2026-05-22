import { describe, expect, it } from "vitest";
import type { BookingStateAuditRow } from "@/lib/database/types";

// Test mapping via load function internals. import file and test through exported loader pattern
// We test filter behavior by re-exporting a test hook or duplicating map logic.
// Here we validate the public event shape through loadAdminOverviewOperationalEvents with a mock client.

describe("adminOverviewOperationalEvents", () => {
  it("filters booking audit commands to operational feed whitelist", async () => {
    const { loadAdminOverviewOperationalEvents } = await import("./adminOverviewOperationalEvents");

    const audits: BookingStateAuditRow[] = [
      {
        id: 1,
        booking_id: "b1",
        command: "CONFIRM_PAYMENT",
        to_status: "confirmed",
        from_status: "pending_payment",
        created_at: "2026-05-21T10:00:00Z",
        actor_type: "system",
        actor_profile_id: null,
        reason: null,
        idempotency_key: null,
        metadata: null,
        payload: null,
      },
      {
        id: 2,
        booking_id: "b2",
        command: "INTERNAL_HEARTBEAT",
        to_status: "confirmed",
        from_status: "confirmed",
        created_at: "2026-05-21T09:00:00Z",
        actor_type: "system",
        actor_profile_id: null,
        reason: null,
        idempotency_key: null,
        metadata: null,
        payload: null,
      },
    ];

    const client = {
      from: (table: string) => {
        const chain = {
          select: () => chain,
          not: () => chain,
          order: () => chain,
          limit: () =>
            Promise.resolve({
              data: table === "booking_state_audit" ? audits : [],
              error: null,
            }),
        };
        return chain;
      },
    };

    const events = await loadAdminOverviewOperationalEvents(client as never);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("Payment confirmed");
    expect(events[0]?.kind).toBe("payment");
  });

  it("includes archived audit rows with null booking_id", async () => {
    const { loadAdminOverviewOperationalEvents } = await import("./adminOverviewOperationalEvents");

    const audits: BookingStateAuditRow[] = [
      {
        id: 3,
        booking_id: null as unknown as string,
        command: "MARK_COMPLETED",
        to_status: "completed",
        from_status: "in_progress",
        created_at: "2026-05-21T11:00:00Z",
        actor_type: "system",
        actor_profile_id: null,
        reason: null,
        idempotency_key: null,
        metadata: null,
        payload: null,
      },
    ];

    const client = {
      from: (table: string) => {
        const chain = {
          select: () => chain,
          order: () => chain,
          limit: () =>
            Promise.resolve({
              data: table === "booking_state_audit" ? audits : [],
              error: null,
            }),
        };
        return chain;
      },
    };

    const events = await loadAdminOverviewOperationalEvents(client as never);
    expect(events).toHaveLength(1);
    expect(events[0]?.bookingId).toBeNull();
    expect(events[0]?.title).toBe("Visit completed");
  });
});
