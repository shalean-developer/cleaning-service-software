import { describe, expect, it } from "vitest";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { isAssignmentRecoveryCandidate } from "./isAssignmentRecoveryCandidate";
import { resolveDeferredDispatchStatus } from "./deferredDispatchStatus";
import { findDeferredAssignmentDispatchCandidates } from "./findDeferredAssignmentDispatchCandidates";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

describe("deferred assignment recovery exclusion", () => {
  it("excludes bookings before dispatch window from recovery", () => {
    const futureDispatch = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      isAssignmentRecoveryCandidate({
        booking: {
          status: "confirmed",
          cleaner_id: null,
          assignment_dispatch_at: futureDispatch,
        },
        payments: [
          {
            status: "paid",
            updated_at: new Date(Date.now() - 60 * 60_000).toISOString(),
            created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
          },
        ],
        offers: [],
        graceMinutes: 3,
      }),
    ).toBe(false);
  });
});

describe("resolveDeferredDispatchStatus", () => {
  it("surfaces awaiting dispatch window for admin and customer", () => {
    const dispatchAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const status = resolveDeferredDispatchStatus({
      bookingStatus: "confirmed",
      assignmentDispatchAt: dispatchAt,
      scheduledStart: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(status.phase).toBe("awaiting_dispatch_window");
    expect(status.adminLabel).toBe("Awaiting dispatch window");
    expect(status.customerMessage).toContain("confirmed");
    expect(status.daysUntilDispatch).toBeGreaterThan(0);
  });

  it("surfaces ready for dispatch when window opened within grace", () => {
    const dispatchAt = new Date(Date.now() - 60_000).toISOString();
    const status = resolveDeferredDispatchStatus({
      bookingStatus: "confirmed",
      assignmentDispatchAt: dispatchAt,
    });
    expect(status.phase).toBe("ready_for_dispatch");
    expect(status.adminLabel).toBe("Ready for dispatch");
    expect(status.operationalAttentionRequired).toBe(false);
  });
});

describe("deferred assignment recovery exclusion", () => {
  it("excludes bookings in ready grace from recovery candidacy", () => {
    const dispatchAt = new Date(Date.now() - 10 * 60_000).toISOString();
    expect(
      isAssignmentRecoveryCandidate({
        booking: {
          status: "confirmed",
          cleaner_id: null,
          assignment_dispatch_at: dispatchAt,
        },
        payments: [
          {
            status: "paid",
            updated_at: new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString(),
            created_at: new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString(),
          },
        ],
        offers: [],
        graceMinutes: 3,
      }),
    ).toBe(false);
  });
});

describe("findDeferredAssignmentDispatchCandidates", () => {
  it("returns eligible confirmed paid booking past dispatch window", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const ts = new Date().toISOString();
    const pastDispatch = new Date(Date.now() - 60_000).toISOString();

    backend.bookings.set(bookingId, {
      id: bookingId,
      customer_id: "cust-1",
      cleaner_id: null,
      service_id: null,
      status: "confirmed",
      scheduled_start: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      scheduled_end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      assignment_dispatch_at: pastDispatch,
      price_cents: 1000,
      currency: "ZAR",
      series_id: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });
    backend.payments.set(paymentId, {
      id: paymentId,
      booking_id: bookingId,
      status: "paid",
      provider: "paystack",
      provider_ref: "ref",
      idempotency_key: "key",
      amount_cents: 1000,
      currency: "ZAR",
      payment_link_expires_at: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });

    const client = {
      from(table: string) {
        if (table === "bookings") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: async () => ({
                        data: [...backend.bookings.values()],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "payments") {
          return {
            select: () => ({
              eq: (_c1: string, v1: string) => ({
                eq: () => ({
                  head: true,
                  count: async () => ({
                    count: [...backend.payments.values()].filter((p) => p.booking_id === v1)
                      .length,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "assignment_offers") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    const candidates = await findDeferredAssignmentDispatchCandidates(client, {
      now: new Date(),
      batchSize: 10,
    });
    expect(candidates.map((c) => c.bookingId)).toContain(bookingId);
  });
});
