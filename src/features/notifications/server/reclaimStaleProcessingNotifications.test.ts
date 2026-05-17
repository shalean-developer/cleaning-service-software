import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationOutboxRow } from "@/lib/database/types";
import { NOTIFICATION_MAX_ATTEMPTS } from "./config";
import {
  RECLAIM_STALE_PROCESSING_LAST_ERROR,
  reclaimStaleProcessingNotifications,
} from "./reclaimStaleProcessingNotifications";

function outboxRow(
  overrides: Partial<NotificationOutboxRow> & Pick<NotificationOutboxRow, "id" | "status">,
): NotificationOutboxRow {
  const ts = "2026-05-17T08:00:00.000Z";
  return {
    channel: "email",
    recipient: "cust-1",
    payload: { template: "payment_confirmed", bookingId: "booking-1" },
    attempts: 1,
    next_retry_at: null,
    last_error: null,
    created_at: ts,
    updated_at: ts,
    ...overrides,
  };
}

function createReclaimMockClient(rows: NotificationOutboxRow[]) {
  return {
    from: (table: string) => {
      if (table !== "notification_outbox") throw new Error("unexpected table");
      return {
        update: (patch: Partial<NotificationOutboxRow>) => ({
          eq: (col: string, val: string) => {
            if (col !== "status" || val !== "processing") {
              return {
                lt: () => ({
                  lt: () => ({ select: async () => ({ data: [], error: null }) }),
                }),
              };
            }
            return {
              lt: (colA: string, cutoffIso: string) => ({
                lt: (colB: string, maxAttempts: number) => ({
                  select: async () => {
                    const reclaimed: { id: string }[] = [];
                    for (const row of rows) {
                      if (row.status !== "processing") continue;
                      if (colA === "updated_at" && row.updated_at >= cutoffIso) continue;
                      if (colB === "attempts" && row.attempts >= maxAttempts) continue;
                      Object.assign(row, patch);
                      reclaimed.push({ id: row.id });
                    }
                    return { data: reclaimed, error: null };
                  },
                }),
              }),
            };
          },
        }),
      };
    },
  } as unknown as SupabaseClient<Database>;
}

describe("reclaimStaleProcessingNotifications", () => {
  it("moves stale processing rows to pending with retry metadata", async () => {
    const stale = outboxRow({
      id: "stale-1",
      status: "processing",
      updated_at: "2026-05-17T08:00:00.000Z",
    });
    const fresh = outboxRow({
      id: "fresh-1",
      status: "processing",
      updated_at: "2026-05-17T10:20:00.000Z",
    });
    const rows = [stale, fresh];

    const now = new Date("2026-05-17T10:30:00.000Z");
    const result = await reclaimStaleProcessingNotifications(
      createReclaimMockClient(rows),
      { now, staleMinutes: 15 },
    );

    expect(result.reclaimed).toBe(1);
    expect(stale.status).toBe("pending");
    expect(stale.next_retry_at).toBe(now.toISOString());
    expect(stale.last_error).toBe(RECLAIM_STALE_PROCESSING_LAST_ERROR);
    expect(stale.attempts).toBe(1);
    expect(fresh.status).toBe("processing");
  });

  it("does not reclaim recent processing rows", async () => {
    const fresh = outboxRow({
      id: "fresh-1",
      status: "processing",
      updated_at: "2026-05-17T10:20:00.000Z",
    });

    const result = await reclaimStaleProcessingNotifications(
      createReclaimMockClient([fresh]),
      { now: new Date("2026-05-17T10:30:00.000Z"), staleMinutes: 15 },
    );

    expect(result.reclaimed).toBe(0);
    expect(fresh.status).toBe("processing");
  });

  it("skips sent and failed rows", async () => {
    const sent = outboxRow({
      id: "sent-1",
      status: "sent",
      updated_at: "2026-05-17T08:00:00.000Z",
    });
    const failed = outboxRow({
      id: "failed-1",
      status: "failed",
      updated_at: "2026-05-17T08:00:00.000Z",
    });

    const result = await reclaimStaleProcessingNotifications(
      createReclaimMockClient([sent, failed]),
      { now: new Date("2026-05-17T10:30:00.000Z"), staleMinutes: 15 },
    );

    expect(result.reclaimed).toBe(0);
    expect(sent.status).toBe("sent");
    expect(failed.status).toBe("failed");
  });

  it("skips processing rows at or above max attempts", async () => {
    const exhausted = outboxRow({
      id: "exhausted-1",
      status: "processing",
      updated_at: "2026-05-17T08:00:00.000Z",
      attempts: NOTIFICATION_MAX_ATTEMPTS,
    });
    const reclaimable = outboxRow({
      id: "ok-1",
      status: "processing",
      updated_at: "2026-05-17T08:00:00.000Z",
      attempts: NOTIFICATION_MAX_ATTEMPTS - 1,
    });

    const result = await reclaimStaleProcessingNotifications(
      createReclaimMockClient([exhausted, reclaimable]),
      { now: new Date("2026-05-17T10:30:00.000Z"), staleMinutes: 15 },
    );

    expect(result.reclaimed).toBe(1);
    expect(exhausted.status).toBe("processing");
    expect(reclaimable.status).toBe("pending");
  });
});
