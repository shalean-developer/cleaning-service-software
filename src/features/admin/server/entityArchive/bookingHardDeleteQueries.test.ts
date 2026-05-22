import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { BOOKING_SOFT_DELETE_DEFAULTS } from "@/lib/database/types";
import { assessBookingHardDeleteEligibility } from "./bookingHardDeleteQueries";

const mockFrom = vi.fn();

function createMockClient(): SupabaseClient<Database> {
  return { from: mockFrom } as unknown as SupabaseClient<Database>;
}

function chain(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

function zeroCountChain() {
  const c = chain();
  c.eq = vi.fn().mockResolvedValue({ count: 0, error: null, data: [] });
  c.in = vi.fn().mockResolvedValue({ count: 0, error: null });
  return c;
}

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

describe("assessBookingHardDeleteEligibility", () => {
  it("allows hard delete when only non-settled payment rows exist", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "payments") {
        const paymentChain = chain();
        paymentChain.eq = vi.fn().mockReturnValue(paymentChain);
        paymentChain.in = vi.fn().mockResolvedValue({ count: 0, error: null });
        return paymentChain;
      }
      if (table === "assignment_offers") {
        return chain({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        });
      }
      return zeroCountChain();
    });

    const result = await assessBookingHardDeleteEligibility(
      createMockClient(),
      safeDraftBooking,
    );

    expect(result.hardDeleteAllowed).toBe(true);
    expect(result.blockedReasons).not.toContain("paid or refunded payment exists");
  });

  it("allows hard delete for archived booking with settled payments and no earnings", async () => {
    mockFrom.mockImplementation((table: string) => {
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
      return zeroCountChain();
    });

    const result = await assessBookingHardDeleteEligibility(createMockClient(), {
      ...safeDraftBooking,
      deleted_at: "2026-05-22T17:29:43.000Z",
    });

    expect(result.hardDeleteAllowed).toBe(true);
    expect(result.blockedReasons).not.toContain("paid or refunded payment exists");
  });

  it("blocks hard delete when settled payments exist on active booking", async () => {
    mockFrom.mockImplementation((table: string) => {
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
      return zeroCountChain();
    });

    const result = await assessBookingHardDeleteEligibility(
      createMockClient(),
      safeDraftBooking,
    );

    expect(result.hardDeleteAllowed).toBe(false);
    expect(result.blockedReasons).toContain("paid or refunded payment exists");
  });
});
