import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { archiveBookingAdminCommand } from "./archiveBookingAdminCommand";

const mockFrom = vi.fn();

function createMockClient(): SupabaseClient<Database> {
  return { from: mockFrom } as unknown as SupabaseClient<Database>;
}

function chain(overrides: Record<string, unknown> = {}) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return chainable;
}

vi.mock("./cancelBookingOpenOffers", () => ({
  cancelBookingOpenOffers: vi.fn(async () => ({
    openOffersCancelled: 0,
    offersExamined: 0,
  })),
}));

vi.mock("./recordAdminDeleteAudit", () => ({
  recordAdminDeleteAudit: vi.fn(async () => "audit-1"),
  findAdminDeleteAuditByIdempotencyKey: vi.fn(async () => null),
}));

describe("archiveBookingAdminCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks archive when booking is assigned", async () => {
    const bookingChain = chain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "booking-1",
          status: "assigned",
          deleted_at: null,
          customer_id: "cust-1",
        },
        error: null,
      }),
    });
    const zeroChain = chain();
    zeroChain.eq = vi.fn().mockReturnValue({
      ...zeroChain,
      eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "bookings") return bookingChain;
      if (table === "payments" || table === "earning_lines") return zeroChain;
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
            }),
          }),
        });
      }
      return chain();
    });

    const result = await archiveBookingAdminCommand(
      {
        bookingId: "booking-1",
        adminProfileId: "admin-1",
        reason: "cleanup",
      },
      createMockClient(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("ACTIVE_ASSIGNMENT_BLOCK");
    }
  });

  it("archives safe draft booking", async () => {
    const bookingRow = {
      id: "booking-2",
      status: "draft",
      deleted_at: null,
      customer_id: "cust-1",
    };
    const bookingSelect = chain({
      maybeSingle: vi.fn().mockResolvedValue({ data: bookingRow, error: null }),
    });
    const bookingUpdate = chain({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let bookingsCall = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "bookings") {
        bookingsCall += 1;
        return bookingsCall === 1 ? bookingSelect : bookingUpdate;
      }
      if (table === "payments" || table === "earning_lines") {
        const c = chain();
        c.eq = vi.fn().mockReturnValue({
          ...c,
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        });
        return c;
      }
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-2" }, error: null }),
            }),
          }),
        });
      }
      return chain();
    });

    const result = await archiveBookingAdminCommand(
      {
        bookingId: "booking-2",
        adminProfileId: "admin-1",
        reason: "test booking cleanup",
      },
      createMockClient(),
    );

    expect(result.ok).toBe(true);
    expect(bookingUpdate.update).toHaveBeenCalled();
  });
});
