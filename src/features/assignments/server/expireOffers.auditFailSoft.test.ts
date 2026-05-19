import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { testAssignmentOfferRow } from "@/features/bookings/server/commands/testAssignmentOfferRow";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";

const cleanerA = "cleaner-a";
const now = new Date("2026-05-17T12:00:00.000Z");

function createOffersClient(backend: InMemoryBookingCommandBackend): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table !== "assignment_offers") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const chain = {
        _filters: {} as { status?: string; lte?: string },
        select: vi.fn(function select(this: typeof chain) {
          return this;
        }),
        eq: vi.fn(function eq(this: typeof chain, col: string, val: unknown) {
          if (col === "status") this._filters.status = String(val);
          return this;
        }),
        not: vi.fn(function not(this: typeof chain) {
          return this;
        }),
        lte: vi.fn(function lte(this: typeof chain, _col: string, val: string) {
          this._filters.lte = val;
          return this;
        }),
        order: vi.fn(function order(this: typeof chain) {
          return this;
        }),
        limit: vi.fn(async function limit(this: typeof chain, n: number) {
          const rows = [...backend.offers.values()].filter((o) => {
            if (o.status !== this._filters.status) return false;
            if (o.expires_at == null) return false;
            if (this._filters.lte && o.expires_at > this._filters.lte) return false;
            return true;
          });
          return { data: rows.slice(0, n), error: null };
        }),
      };

      return chain;
    },
  } as unknown as SupabaseClient<Database>;
}

describe("expireStaleAssignmentOffers command fail-soft", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("continues batch when expire command fails and leaves offer offered", async () => {
    const { expireStaleAssignmentOffers } = await import("./expireOffers");
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const offerId = crypto.randomUUID();

    const ts = "2026-05-16T10:00:00.000Z";
    await backend.insertBooking({
      id: bookingId,
      customer_id: "customer-1",
      cleaner_id: null,
      service_id: null,
      status: "pending_assignment",
      scheduled_start: ts,
      scheduled_end: ts,
      assignment_dispatch_at: null,
      price_cents: 1000,
      currency: "ZAR",
      series_id: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });

    backend.offers.set(
      offerId,
      testAssignmentOfferRow({
        id: offerId,
        booking_id: bookingId,
        cleaner_id: cleanerA,
        status: "offered",
        offered_at: ts,
        expires_at: "2026-05-17T10:00:00.000Z",
        created_at: ts,
        updated_at: ts,
      }),
    );

    const appendSpy = vi
      .spyOn(backend, "appendAudit")
      .mockRejectedValue(new Error("audit failed"));

    const client = createOffersClient(backend);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await expireStaleAssignmentOffers(client, backend, now);

    expect(result.expiredCount).toBe(0);
    expect(backend.offers.get(offerId)?.status).toBe("offered");
    expect(result.bookingIds).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
    appendSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
