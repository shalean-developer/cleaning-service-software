import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { BOOKING_SOFT_DELETE_DEFAULTS } from "@/lib/database/types";
import { hardDeleteBookingAdminCommand } from "./hardDeleteBookingAdminCommand";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

function createMockClient(): SupabaseClient<Database> {
  return { from: mockFrom, rpc: mockRpc } as unknown as SupabaseClient<Database>;
}

function chain(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

function zeroCountChain() {
  const c = chain();
  c.eq = vi.fn().mockReturnValue(c);
  c.in = vi.fn().mockResolvedValue({ count: 0, error: null, data: [] });
  return c;
}

vi.mock("./recordAdminDeleteAudit", () => ({
  recordAdminDeleteAudit: vi.fn(async () => "audit-1"),
  findAdminDeleteAuditByIdempotencyKey: vi.fn(async () => null),
}));

const safeDraftBooking = {
  id: "booking-draft",
  customer_id: "cust-1",
  cleaner_id: null,
  service_id: null,
  status: "draft" as const,
  scheduled_start: "2026-06-01T08:00:00.000Z",
  scheduled_end: "2026-06-01T10:00:00.000Z",
  assignment_dispatch_at: null,
  price_cents: 10000,
  currency: "ZAR",
  series_id: null,
  synthetic_anchor: false,
  metadata: {},
  ...BOOKING_SOFT_DELETE_DEFAULTS,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
};

describe("hardDeleteBookingAdminCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ error: null });
  });

  function mockEligibilityTables(booking = safeDraftBooking) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookings") {
        return chain({
          maybeSingle: vi.fn().mockResolvedValue({ data: booking, error: null }),
        });
      }
      if (table === "assignment_offers") {
        return chain({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      }
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
            }),
          }),
        });
      }
      return zeroCountChain();
    });
  }

  it("permanently deletes safe draft booking", async () => {
    mockEligibilityTables();
    const result = await hardDeleteBookingAdminCommand(
      {
        bookingId: "booking-draft",
        adminProfileId: "admin-1",
        reason: "test duplicate",
      },
      createMockClient(),
    );
    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("admin_hard_delete_booking", {
      p_booking_id: "booking-draft",
    });
  });

  it("permanently deletes archived booking with settled payments when no earnings", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookings") {
        return chain({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              ...safeDraftBooking,
              deleted_at: "2026-05-22T17:29:43.000Z",
            },
            error: null,
          }),
        });
      }
      if (table === "payments") {
        const paymentChain = chain();
        paymentChain.eq = vi.fn().mockReturnValue(paymentChain);
        paymentChain.in = vi.fn().mockResolvedValue({ count: 1, error: null });
        return paymentChain;
      }
      if (table === "assignment_offers") {
        return chain({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      }
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
            }),
          }),
        });
      }
      return zeroCountChain();
    });

    const result = await hardDeleteBookingAdminCommand(
      {
        bookingId: "booking-draft",
        adminProfileId: "admin-1",
        reason: "purge archived test booking",
      },
      createMockClient(),
    );

    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("admin_hard_delete_booking", {
      p_booking_id: "booking-draft",
    });
  });

  it("blocks hard delete when settled payments exist on active booking", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookings") {
        return chain({
          maybeSingle: vi.fn().mockResolvedValue({ data: safeDraftBooking, error: null }),
        });
      }
      if (table === "payments") {
        const paymentChain = chain();
        paymentChain.eq = vi.fn().mockReturnValue(paymentChain);
        paymentChain.in = vi.fn().mockResolvedValue({ count: 1, error: null });
        return paymentChain;
      }
      if (table === "assignment_offers") {
        return chain({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      }
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
            }),
          }),
        });
      }
      return zeroCountChain();
    });

    const result = await hardDeleteBookingAdminCommand(
      {
        bookingId: "booking-draft",
        adminProfileId: "admin-1",
        reason: "cleanup",
      },
      createMockClient(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HARD_DELETE_NOT_ALLOWED");
      expect(mockRpc).not.toHaveBeenCalled();
    }
  });

  it("blocks hard delete for completed lifecycle status", async () => {
    mockEligibilityTables({ ...safeDraftBooking, status: "completed" });
    const result = await hardDeleteBookingAdminCommand(
      {
        bookingId: "booking-draft",
        adminProfileId: "admin-1",
        reason: "cleanup",
      },
      createMockClient(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HARD_DELETE_NOT_ALLOWED");
      expect(result.blockedReason).toContain("lifecycle status");
    }
  });

  it("blocks hard delete when cleaner is assigned", async () => {
    mockEligibilityTables({
      ...safeDraftBooking,
      cleaner_id: "cleaner-1",
      status: "assigned",
    });
    const result = await hardDeleteBookingAdminCommand(
      {
        bookingId: "booking-draft",
        adminProfileId: "admin-1",
        reason: "cleanup",
      },
      createMockClient(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HARD_DELETE_NOT_ALLOWED");
    }
  });

  it("blocks hard delete when recurring series is linked", async () => {
    mockEligibilityTables({ ...safeDraftBooking, series_id: "series-1" });
    const result = await hardDeleteBookingAdminCommand(
      {
        bookingId: "booking-draft",
        adminProfileId: "admin-1",
        reason: "cleanup",
      },
      createMockClient(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blockedReason).toContain("recurring series");
    }
  });
});
