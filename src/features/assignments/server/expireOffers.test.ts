import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentOfferRow, Database } from "@/lib/database/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { testAssignmentOfferRow } from "@/features/bookings/server/commands/testAssignmentOfferRow";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { readAssignmentMetadata } from "./assignmentMetadata";
import { expireStaleAssignmentOffers } from "./expireOffers";
import { isOfferOpenForOps } from "./buildOfferExpiry";

const eligibilityMock = vi.hoisted(() => ({
  pickBestEligibleCleanerIdExcluding: vi.fn(),
}));

const contextMock = vi.hoisted(() => ({
  loadAssignmentContext: vi.fn(),
}));

vi.mock("./eligibilityForAssignment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./eligibilityForAssignment")>();
  return {
    ...actual,
    pickBestEligibleCleanerIdExcluding: eligibilityMock.pickBestEligibleCleanerIdExcluding,
  };
});

vi.mock("./assignmentContext", () => ({
  loadAssignmentContext: (...args: unknown[]) => contextMock.loadAssignmentContext(...args),
}));

const systemActor = { actorType: "system" as const, profileId: null };
const customerId = "customer-1";
const cleanerA = "cleaner-a";
const cleanerB = "cleaner-b";

function createOffersClient(
  backend: InMemoryBookingCommandBackend,
  now: Date,
): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table !== "assignment_offers") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const chain = {
        _filters: {} as {
          status?: string;
          lte?: { col: string; val: string };
        },
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
        lte: vi.fn(function lte(this: typeof chain, col: string, val: string) {
          this._filters.lte = { col, val };
          return this;
        }),
        order: vi.fn(function order(this: typeof chain) {
          return this;
        }),
        limit: vi.fn(async function limit(this: typeof chain, n: number) {
          const rows = [...backend.offers.values()].filter((o) => {
            if (o.status !== this._filters.status) return false;
            if (o.expires_at == null) return false;
            if (this._filters.lte && o.expires_at > this._filters.lte.val) return false;
            return true;
          });
          return { data: rows.slice(0, n), error: null };
        }),
      };

      return chain;
    },
  } as unknown as SupabaseClient<Database>;
}

async function paidPendingBooking(
  backend: InMemoryBookingCommandBackend,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
      priceCents: 50_000,
      metadata,
    },
    { actingCustomerId: customerId },
  );
  if (!draft.ok) throw new Error("draft failed");

  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentIdempotencyKey: `pay-${draft.bookingId}`,
    },
    { actingCustomerId: customerId },
  );

  const payment = [...backend.payments.values()][0]!;
  await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentId: payment.id,
      idempotencyKey: `fin-${draft.bookingId}`,
    },
    {},
  );

  await executeBookingCommand(
    backend,
    {
      type: "MOVE_TO_PENDING_ASSIGNMENT",
      actor: systemActor,
      bookingId: draft.bookingId,
    },
    {},
  );

  return draft.bookingId;
}

describe("expireStaleAssignmentOffers", () => {
  let backend: InMemoryBookingCommandBackend;
  const now = new Date("2026-05-18T12:00:00.000Z");

  beforeEach(() => {
    backend = new InMemoryBookingCommandBackend();
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockReset();
    contextMock.loadAssignmentContext.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("marks stale offered rows expired and sets attention_required", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = crypto.randomUUID();
    backend.offers.set(
      offerId,
      testAssignmentOfferRow({
        id: offerId,
        booking_id: bookingId,
        cleaner_id: cleanerA,
        status: "offered",
        offered_at: "2026-05-16T10:00:00.000Z",
        expires_at: "2026-05-17T10:00:00.000Z",
        created_at: "2026-05-16T10:00:00.000Z",
        updated_at: "2026-05-16T10:00:00.000Z",
      }),
    );

    await executeBookingCommand(
      backend,
      {
        type: "RECORD_ASSIGNMENT_ATTENTION",
        actor: { actorType: "service", profileId: null },
        bookingId,
        assignment: {
          engineVersion: "2026-05-16-phase8",
          status: "offered",
          path: "selected",
          cleanerId: cleanerA,
          offerId,
          reason: null,
          attemptedAt: "2026-05-16T10:00:00.000Z",
        },
        idempotencyKey: `assignment:meta:${bookingId}:offered:selected`,
      },
      {},
    );

    const client = createOffersClient(backend, now);
    const first = await expireStaleAssignmentOffers(client, backend, now);
    expect(first.expiredCount).toBe(1);
    expect(backend.offers.get(offerId)?.status).toBe("expired");

    const expiryAudits = backend.audits.filter(
      (a) => a.command === "EXPIRE_ASSIGNMENT_OFFER",
    );
    expect(expiryAudits).toHaveLength(1);
    expect(expiryAudits[0]?.idempotency_key).toBe(`cron:expire-offer:${offerId}`);

    const booking = await backend.getBooking(bookingId);
    const meta = readAssignmentMetadata(booking?.metadata);
    expect(meta?.status).toBe("attention_required");
    expect(meta?.reason).toContain("selected cleaner");
  });

  it("is idempotent when run twice", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = crypto.randomUUID();
    backend.offers.set(
      offerId,
      testAssignmentOfferRow({
        id: offerId,
        booking_id: bookingId,
        cleaner_id: cleanerA,
        status: "offered",
        offered_at: "2026-05-16T10:00:00.000Z",
        expires_at: "2026-05-17T10:00:00.000Z",
        created_at: "2026-05-16T10:00:00.000Z",
        updated_at: "2026-05-16T10:00:00.000Z",
      }),
    );

    const client = createOffersClient(backend, now);
    const first = await expireStaleAssignmentOffers(client, backend, now);
    const second = await expireStaleAssignmentOffers(client, backend, now);
    expect(first.expiredCount).toBe(1);
    expect(second.expiredCount).toBe(0);
    expect([...backend.offers.values()].filter((o) => o.status === "expired")).toHaveLength(1);
    expect(
      backend.audits.filter((a) => a.command === "EXPIRE_ASSIGNMENT_OFFER"),
    ).toHaveLength(1);
  });

  it("auto-redispatches best_available without duplicating active offers", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = crypto.randomUUID();
    backend.offers.set(
      offerId,
      testAssignmentOfferRow({
        id: offerId,
        booking_id: bookingId,
        cleaner_id: cleanerA,
        status: "offered",
        offered_at: "2026-05-16T10:00:00.000Z",
        expires_at: "2026-05-17T10:00:00.000Z",
        created_at: "2026-05-16T10:00:00.000Z",
        updated_at: "2026-05-16T10:00:00.000Z",
      }),
    );

    await executeBookingCommand(
      backend,
      {
        type: "RECORD_ASSIGNMENT_ATTENTION",
        actor: { actorType: "service", profileId: null },
        bookingId,
        assignment: {
          engineVersion: "2026-05-16-phase8",
          status: "offered",
          path: "best_available",
          cleanerId: cleanerA,
          offerId,
          reason: null,
          attemptedAt: "2026-05-16T10:00:00.000Z",
        },
        idempotencyKey: `assignment:meta:${bookingId}:offered:best_available`,
      },
      {},
    );

    contextMock.loadAssignmentContext.mockResolvedValue({
      bookingId,
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
      scheduleTimezone: "Africa/Johannesburg",
      areaSlug: "cape-town",
      serviceSlug: "regular-cleaning",
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        teamSize: 1,
      },
      cleanerPreference: { mode: "best_available", selectedCleanerId: null },
      preferredCleanerId: null,
    });
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockResolvedValue(cleanerB);

    const client = createOffersClient(backend, now);
    const result = await expireStaleAssignmentOffers(client, backend, now);

    expect(result.redispatchedBookingIds).toContain(bookingId);
    const open = [...backend.offers.values()].filter(
      (o) => o.booking_id === bookingId && isOfferOpenForOps(o, now),
    );
    expect(open).toHaveLength(1);
    expect(open[0]?.cleaner_id).toBe(cleanerB);
    expect(open[0]?.cleaner_id).not.toBe(cleanerA);
  });
});
