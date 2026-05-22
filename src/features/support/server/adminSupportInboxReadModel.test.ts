import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import {
  computeSupportInboxPriorityForTest,
  listAdminSupportInbox,
} from "./adminSupportInboxReadModel";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

type Fixture = {
  bookingRequests: Record<string, unknown>[];
  recurringRequests: Record<string, unknown>[];
  bookings?: Record<string, unknown>[];
  customers?: Record<string, unknown>[];
  series?: Record<string, unknown>[];
};

function createClient(fixture: Fixture) {
  return {
    from(table: string) {
      if (table === "booking_support_requests") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: fixture.bookingRequests, error: null }),
            }),
          }),
        };
      }
      if (table === "recurring_series_requests") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: fixture.recurringRequests, error: null }),
            }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            in: async () => ({ data: fixture.bookings ?? [], error: null }),
          }),
        };
      }
      if (table === "payments") {
        return {
          select: () => ({
            in: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "customers") {
        return {
          select: () => ({
            in: async () => ({ data: fixture.customers ?? [], error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }
      if (table === "booking_series") {
        return {
          select: () => ({
            in: async () => ({ data: fixture.series ?? [], error: null }),
          }),
        };
      }
      if (table === "cleaners") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("adminSupportInboxReadModel", () => {
  beforeEach(() => {
    createSupabaseServerClientMock.mockReset();
  });

  it("loads one-off and recurring support requests", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        bookingRequests: [
          {
            id: "bsr-1",
            booking_id: "book-1",
            customer_id: "cust-1",
            request_type: "payment_help",
            status: "open",
            message: "Need help paying",
            preferred_new_time: null,
            created_at: "2026-05-20T10:00:00.000Z",
            updated_at: "2026-05-20T10:00:00.000Z",
            resolved_at: null,
          },
        ],
        recurringRequests: [
          {
            id: "rsr-1",
            series_id: "series-1",
            group_id: null,
            customer_id: "cust-1",
            request_type: "pause",
            scope: "series",
            status: "open",
            note: "Going away",
            created_at: "2026-05-19T10:00:00.000Z",
            updated_at: "2026-05-19T10:00:00.000Z",
            resolved_at: null,
            target_weekday: 2,
            metadata: {},
          },
        ],
        bookings: [
          {
            id: "book-1",
            status: "confirmed",
            scheduled_start: "2026-05-25T08:00:00.000Z",
            cleaner_id: null,
            metadata: {},
          },
        ],
        customers: [
          { id: "cust-1", profile_id: null, company_name: "Acme", phone: "+27821234567" },
        ],
        series: [{ id: "series-1", frequency: "weekly" }],
      }),
    );

    const result = await listAdminSupportInbox(adminUser);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items).toHaveLength(2);
    expect(result.items.some((i) => i.source === "booking_support")).toBe(true);
    expect(result.items.some((i) => i.source === "recurring_support")).toBe(true);
  });

  it("merges and sorts urgent before normal by date", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        bookingRequests: [
          {
            id: "bsr-old",
            booking_id: "book-1",
            customer_id: "cust-1",
            request_type: "general_message",
            status: "open",
            message: "Hi",
            preferred_new_time: null,
            created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            resolved_at: null,
          },
          {
            id: "bsr-new",
            booking_id: "book-2",
            customer_id: "cust-1",
            request_type: "general_message",
            status: "acknowledged",
            message: "Thanks",
            preferred_new_time: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            resolved_at: null,
          },
        ],
        recurringRequests: [],
        bookings: [
          {
            id: "book-1",
            status: "confirmed",
            scheduled_start: "2026-12-01T08:00:00.000Z",
            cleaner_id: null,
            metadata: {},
          },
          {
            id: "book-2",
            status: "confirmed",
            scheduled_start: "2026-12-02T08:00:00.000Z",
            cleaner_id: null,
            metadata: {},
          },
        ],
        customers: [
          { id: "cust-1", profile_id: null, company_name: "Acme", phone: null },
        ],
      }),
    );

    const result = await listAdminSupportInbox(adminUser);
    if (!result.ok) throw new Error("expected ok");
    expect(result.items[0]?.id).toBe("bsr-old");
    expect(result.items[0]?.priority).toBe("urgent");
    expect(result.items[1]?.priority).toBe("normal");
  });

  it("handles missing booking context gracefully", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        bookingRequests: [
          {
            id: "bsr-orphan",
            booking_id: "missing-booking",
            customer_id: "cust-1",
            request_type: "service_issue",
            status: "open",
            message: "Issue",
            preferred_new_time: null,
            created_at: new Date().toISOString(),
            resolved_at: null,
          },
        ],
        recurringRequests: [],
        customers: [
          { id: "cust-1", profile_id: null, company_name: "Acme", phone: null },
        ],
      }),
    );

    const result = await listAdminSupportInbox(adminUser);
    if (!result.ok) throw new Error("expected ok");
    const item = result.items[0];
    expect(item?.bookingStatus).toBeNull();
    expect(item?.bookingHref).toBe("/admin/bookings/missing-booking");
  });

  it("filters by source and search", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        bookingRequests: [
          {
            id: "bsr-1",
            booking_id: "book-1",
            customer_id: "cust-1",
            request_type: "cancel",
            status: "open",
            message: "Please cancel",
            preferred_new_time: null,
            created_at: new Date().toISOString(),
            resolved_at: null,
          },
        ],
        recurringRequests: [
          {
            id: "rsr-1",
            series_id: "series-1",
            group_id: null,
            customer_id: "cust-2",
            request_type: "pause",
            scope: "series",
            status: "open",
            note: "Pause please",
            created_at: new Date().toISOString(),
            resolved_at: null,
            target_weekday: null,
            metadata: {},
          },
        ],
        bookings: [
          {
            id: "book-1",
            status: "confirmed",
            scheduled_start: "2026-12-01T08:00:00.000Z",
            metadata: { quote: { input: { suburb: "Sea Point" } } },
          },
        ],
        customers: [
          { id: "cust-1", profile_id: null, company_name: "Sea Point Co", phone: null },
          { id: "cust-2", profile_id: null, company_name: "Other", phone: null },
        ],
        series: [{ id: "series-1", frequency: "weekly" }],
      }),
    );

    const recurringOnly = await listAdminSupportInbox(adminUser, { filter: "recurring" });
    if (!recurringOnly.ok) throw new Error("expected ok");
    expect(recurringOnly.items.every((i) => i.source === "recurring_support")).toBe(true);

    const search = await listAdminSupportInbox(adminUser, { search: "sea point" });
    if (!search.ok) throw new Error("expected ok");
    expect(search.items.some((i) => i.customerName.includes("Sea Point"))).toBe(true);
  });

  it("filters breached SLA view", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      createClient({
        bookingRequests: [
          {
            id: "bsr-breach",
            booking_id: "book-1",
            customer_id: "cust-1",
            request_type: "payment_help",
            status: "open",
            message: "Pay",
            preferred_new_time: null,
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            resolved_at: null,
          },
        ],
        recurringRequests: [],
        bookings: [
          {
            id: "book-1",
            status: "confirmed",
            scheduled_start: "2026-12-01T08:00:00.000Z",
            cleaner_id: null,
            metadata: {},
          },
        ],
        customers: [
          { id: "cust-1", profile_id: null, company_name: "Acme", phone: null },
        ],
      }),
    );

    const result = await listAdminSupportInbox(adminUser, { filter: "breached" });
    if (!result.ok) throw new Error("expected ok");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((i) => i.slaStatus === "breached")).toBe(true);
  });

  it("computes urgent priority for payment_help and cleaner_issue", () => {
    expect(
      computeSupportInboxPriorityForTest({
        status: "open",
        requestType: "payment_help",
        createdAt: new Date().toISOString(),
        scheduledStart: null,
        requestedDateTimeIso: null,
      }),
    ).toBe("urgent");

    expect(
      computeSupportInboxPriorityForTest({
        status: "open",
        requestType: "cleaner_issue",
        createdAt: new Date().toISOString(),
        scheduledStart: null,
        requestedDateTimeIso: null,
      }),
    ).toBe("urgent");

    expect(
      computeSupportInboxPriorityForTest({
        status: "resolved",
        requestType: "payment_help",
        createdAt: new Date().toISOString(),
        scheduledStart: null,
        requestedDateTimeIso: null,
      }),
    ).toBe("low");
  });
});
