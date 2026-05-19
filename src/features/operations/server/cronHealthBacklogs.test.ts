import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  countPastExpiryOpenOfferBacklog,
  countStalePendingPaymentBacklog,
  summarizeStalePaymentScan,
} from "./cronHealthBacklogs";

vi.mock("@/features/assignments/server/findAssignmentRecoveryCandidates", () => ({
  findAssignmentRecoveryCandidates: vi.fn(async () => []),
}));

vi.mock("@/features/assignments/server/deferredAssignmentDiagnostics", () => ({
  getDeferredAssignmentDiagnostics: vi.fn(async () => ({
    deferredAssignmentEnabled: false,
    awaitingDispatchWindowCount: 0,
    readyForDispatchCount: 0,
    overdueDispatchCount: 0,
    oldestOverdueDispatchAt: null,
    lastCronRun: null,
  })),
}));

describe("summarizeStalePaymentScan", () => {
  it("counts only pending_payment bookings past expiry", () => {
    const now = new Date("2030-06-01T12:00:00.000Z");
    const { backlogCount } = summarizeStalePaymentScan(
      [
        {
          id: "pay-1",
          booking_id: "book-1",
          status: "pending",
          payment_link_expires_at: "2030-06-01T10:00:00.000Z",
          created_at: "2030-06-01T09:00:00.000Z",
        },
        {
          id: "pay-2",
          booking_id: "book-2",
          status: "pending",
          payment_link_expires_at: "2030-06-01T11:00:00.000Z",
          created_at: "2030-06-01T09:00:00.000Z",
        },
      ],
      new Map([
        ["book-1", "pending_payment"],
        ["book-2", "confirmed"],
      ]),
      now,
    );
    expect(backlogCount).toBe(1);
  });
});

describe("countStalePendingPaymentBacklog", () => {
  it("returns count from mocked payments query", async () => {
    const client = {
      from(table: string) {
        if (table === "payments") {
          return {
            select: () => ({
              in: () => ({
                or: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: "pay-1",
                        booking_id: "book-1",
                        status: "pending",
                        payment_link_expires_at: "2030-06-01T08:00:00.000Z",
                        created_at: "2030-06-01T07:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: "book-1", status: "pending_payment" }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    const count = await countStalePendingPaymentBacklog(client, {
      now: new Date("2030-06-01T12:00:00.000Z"),
    });
    expect(count).toBe(1);
  });
});

describe("countPastExpiryOpenOfferBacklog", () => {
  it("returns head count for offered rows past expires_at", async () => {
    const client = {
      from(table: string) {
        if (table === "assignment_offers") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  lte: async () => ({ count: 4, error: null }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    await expect(countPastExpiryOpenOfferBacklog(client)).resolves.toBe(4);
  });
});
