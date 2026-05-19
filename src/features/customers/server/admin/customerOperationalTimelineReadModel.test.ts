import { describe, expect, it, vi } from "vitest";
import type {
  BookingStateAuditRow,
  CustomerOperationalAuditRow,
  PaymentRow,
} from "@/lib/database/types";
import { CUSTOMER_ACTIVITY_TIMELINE_LIMIT } from "./customerOperationalTimelineTypes";
import {
  buildCustomerOperationalTimelineEvents,
  type BookingTimelineSlice,
} from "./customerOperationalTimelineReadModel";

const CUSTOMER_A = "11111111-1111-1111-1111-111111111111";
const BOOKING_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const BOOKING_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

describe("buildCustomerOperationalTimelineEvents", () => {
  it("maps customer_created audit events as Admin", () => {
    const audits: CustomerOperationalAuditRow[] = [
      {
        id: "audit-1",
        customer_id: CUSTOMER_A,
        admin_profile_id: "admin-1",
        action: "customer_created",
        outcome: "success",
        reason: null,
        metadata: {},
        idempotency_key: null,
        created_at: "2026-05-20T10:00:00.000Z",
      },
    ];

    const events = buildCustomerOperationalTimelineEvents({
      customerAudits: audits,
      bookings: [],
      bookingAudits: [],
      payments: [],
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.source).toBe("Admin");
    expect(events[0]?.title).toBe("Customer account created");
  });

  it("maps customer_updated audit with changed_fields", () => {
    const audits: CustomerOperationalAuditRow[] = [
      {
        id: "audit-2",
        customer_id: CUSTOMER_A,
        admin_profile_id: "admin-1",
        action: "customer_updated",
        outcome: "success",
        reason: null,
        metadata: { changed_fields: ["company_name", "phone"] },
        idempotency_key: null,
        created_at: "2026-05-20T11:00:00.000Z",
      },
    ];

    const events = buildCustomerOperationalTimelineEvents({
      customerAudits: audits,
      bookings: [],
      bookingAudits: [],
      payments: [],
    });

    expect(events[0]?.title).toBe("Customer profile updated");
    expect(events[0]?.detail).toContain("company name");
  });

  it("maps booking creation and links to admin booking page", () => {
    const bookings: BookingTimelineSlice[] = [
      {
        id: BOOKING_A,
        status: "draft",
        scheduled_start: "2026-06-01T08:00:00.000Z",
        series_id: null,
        metadata: {},
        created_at: "2026-05-19T09:00:00.000Z",
      },
    ];

    const events = buildCustomerOperationalTimelineEvents({
      customerAudits: [],
      bookings,
      bookingAudits: [],
      payments: [],
    });

    expect(events[0]?.source).toBe("Booking");
    expect(events[0]?.title).toBe("Booking created");
    expect(events[0]?.bookingHref).toBe(`/admin/bookings/${BOOKING_A}`);
  });

  it("maps payment events including failed payments", () => {
    const payments: PaymentRow[] = [
      {
        id: "pay-1",
        booking_id: BOOKING_A,
        status: "failed",
        provider: "paystack",
        provider_ref: "ref-1",
        idempotency_key: "idem-1",
        amount_cents: 50000,
        currency: "ZAR",
        payment_link_expires_at: null,
        metadata: {},
        created_at: "2026-05-19T10:00:00.000Z",
        updated_at: "2026-05-19T10:05:00.000Z",
      },
    ];

    const events = buildCustomerOperationalTimelineEvents({
      customerAudits: [],
      bookings: [],
      bookingAudits: [],
      payments,
    });

    expect(events[0]?.source).toBe("Payment");
    expect(events[0]?.title).toBe("Payment failed");
    expect(events[0]?.bookingHref).toContain(BOOKING_A);
  });

  it("maps booking status audit and completed bookings", () => {
    const bookingAudits: BookingStateAuditRow[] = [
      {
        id: 1,
        booking_id: BOOKING_A,
        from_status: "confirmed",
        to_status: "completed",
        command: "MARK_COMPLETED",
        actor_profile_id: null,
        payload: {},
        created_at: "2026-05-19T12:00:00.000Z",
        actor_type: "system",
        reason: null,
        idempotency_key: null,
        metadata: {},
      },
    ];

    const events = buildCustomerOperationalTimelineEvents({
      customerAudits: [],
      bookings: [],
      bookingAudits,
      payments: [],
    });

    expect(events[0]?.title).toBe("Booking completed");
    expect(events[0]?.source).toBe("System");
  });

  it("sorts newest first and limits to latest events", () => {
    const events = buildCustomerOperationalTimelineEvents({
      customerAudits: [
        {
          id: "old",
          customer_id: CUSTOMER_A,
          admin_profile_id: null,
          action: "customer_created",
          outcome: "success",
          reason: null,
          metadata: {},
          idempotency_key: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      bookings: [],
      bookingAudits: [],
      payments: Array.from({ length: CUSTOMER_ACTIVITY_TIMELINE_LIMIT + 5 }, (_, i) => ({
        id: `pay-${i}`,
        booking_id: BOOKING_A,
        status: "paid" as const,
        provider: "paystack",
        provider_ref: null,
        idempotency_key: `idem-${i}`,
        amount_cents: 100,
        currency: "ZAR",
        payment_link_expires_at: null,
        metadata: {},
        created_at: `2026-05-${String(20 - i).padStart(2, "0")}T10:00:00.000Z`,
        updated_at: `2026-05-${String(20 - i).padStart(2, "0")}T10:00:00.000Z`,
      })),
    });

    expect(events.length).toBe(CUSTOMER_ACTIVITY_TIMELINE_LIMIT);
    expect(events[0]!.at >= events[1]!.at).toBe(true);
  });
});

describe("getCustomerOperationalTimeline", () => {
  it("rejects non-admin callers", async () => {
    vi.resetModules();
    const { getCustomerOperationalTimeline } = await import(
      "./customerOperationalTimelineReadModel"
    );

    const result = await getCustomerOperationalTimeline(
      {
        profileId: "profile-customer",
        role: "customer",
        authUser: { id: "auth-customer" } as never,
      },
      CUSTOMER_A,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });
});
