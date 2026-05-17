import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  PAYSTACK_DECLINED_FAILURE_REASON,
} from "@/features/bookings/server/paymentFailureDisplay";
import { loadPaymentFailedNotificationContext } from "./loadPaymentFailedNotificationContext";

vi.mock("@/features/bookings/server/paymentRetryEligibility", () => ({
  assessPaymentRetryEligibility: vi.fn(() => true),
}));

describe("loadPaymentFailedNotificationContext", () => {
  it("hydrates failure reason from latest MARK_PAYMENT_FAILED audit", async () => {
    const client = {
      from: (table: string) => {
        if (table === "booking_state_audit") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        command: "MARK_PAYMENT_PENDING",
                        metadata: {},
                        created_at: "2026-05-17T12:00:00.000Z",
                      },
                      {
                        command: "MARK_PAYMENT_FAILED",
                        metadata: { failure_reason: PAYSTACK_DECLINED_FAILURE_REASON },
                        created_at: "2026-05-17T11:00:00.000Z",
                      },
                      {
                        command: "MARK_PAYMENT_FAILED",
                        metadata: { failure_reason: CHECKOUT_EXPIRED_FAILURE_REASON },
                        created_at: "2026-05-17T10:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "payments") {
          return {
            select: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    const result = await loadPaymentFailedNotificationContext(client, {
      id: "booking-1",
      status: "payment_failed",
      scheduled_start: "2026-06-01T08:00:00.000Z",
      price_cents: 53_000,
      metadata: {},
    });

    expect(result.failureReason).toBe(PAYSTACK_DECLINED_FAILURE_REASON);
    expect(result.canRetry).toBe(true);
  });

  it("returns null failure reason when audit has no failure_reason", async () => {
    const client = {
      from: (table: string) => {
        if (table === "booking_state_audit") {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        command: "MARK_PAYMENT_FAILED",
                        metadata: { source: "expire_pending_payment_cron" },
                        created_at: "2026-05-17T10:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "payments") {
          return {
            select: () => ({
              eq: async () => ({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    const result = await loadPaymentFailedNotificationContext(client, {
      id: "booking-1",
      status: "payment_failed",
      scheduled_start: "2026-06-01T08:00:00.000Z",
      price_cents: 53_000,
      metadata: {},
    });

    expect(result.failureReason).toBeNull();
  });
});
