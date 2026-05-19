import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentOfferRow, Database } from "@/lib/database/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { testAssignmentOfferRow } from "@/features/bookings/server/commands/testAssignmentOfferRow";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { readAssignmentMetadata } from "./assignmentMetadata";
import { buildOfferExpiresAt } from "./buildOfferExpiry";
import { createDispatchOffer } from "./createDispatchOffer";
import { declineCleanerOffer } from "./respondToOffer";
import { handleOfferDeclinedFollowUp } from "./handleOfferDeclinedFollowUp";
import { processBookingAfterOfferEnded } from "./processBookingAfterOfferEnded";
import { processBookingAfterOfferExpiry } from "./processBookingAfterOfferExpiry";
import { expireStaleAssignmentOffers } from "./expireOffers";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING } from "./constants";

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
const cleanerC = "cleaner-c";
const cleanerProfileA = "profile-cleaner-a";

function createOffersClient(
  backend: InMemoryBookingCommandBackend,
): SupabaseClient<Database> {
  return {
    from(table: string) {
      if (table !== "assignment_offers") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const expireChain = {
        _filters: {} as { status?: string; lte?: string },
        select: vi.fn(function select(this: typeof expireChain) {
          return this;
        }),
        eq: vi.fn(function eq(this: typeof expireChain, col: string, val: unknown) {
          if (col === "status") this._filters.status = String(val);
          return this;
        }),
        not: vi.fn(function not(this: typeof expireChain) {
          return this;
        }),
        lte: vi.fn(function lte(this: typeof expireChain, _col: string, val: string) {
          this._filters.lte = val;
          return this;
        }),
        order: vi.fn(function order(this: typeof expireChain) {
          return this;
        }),
        limit: vi.fn(async function limit(this: typeof expireChain, n: number) {
          const rows = [...backend.offers.values()].filter((o) => {
            if (this._filters.status && o.status !== this._filters.status) return false;
            if (o.expires_at == null) return false;
            if (this._filters.lte && o.expires_at > this._filters.lte) return false;
            return true;
          });
          return { data: rows.slice(0, n), error: null };
        }),
        update: vi.fn((patch: Partial<AssignmentOfferRow>) => ({
          eq: vi.fn((_col: string, id: string) => ({
            eq: vi.fn((_col2: string, status: string) => ({
              select: vi.fn(async () => {
                const offer = backend.offers.get(id);
                if (!offer || offer.status !== status) {
                  return { data: [], error: null };
                }
                backend.offers.set(id, {
                  ...offer,
                  ...patch,
                  updated_at: patch.updated_at ?? offer.updated_at,
                });
                return { data: [{ id }], error: null };
              }),
            })),
          })),
        })),
      };

      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (col === "booking_id") {
              return {
                order: async () => ({
                  data: [...backend.offers.values()]
                    .filter((o) => o.booking_id === val)
                    .sort((a, b) => a.created_at.localeCompare(b.created_at)),
                  error: null,
                }),
              };
            }
            return expireChain.eq(col, val);
          },
        }),
        update: expireChain.update,
      };
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
    { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId: draft.bookingId },
    {},
  );

  return draft.bookingId;
}

function mockAssignmentContext(bookingId: string) {
  return {
    bookingId,
    scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
    scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
    scheduleTimezone: "Africa/Johannesburg",
    areaSlug: "cape-town",
    serviceSlug: "regular-cleaning",
    pricingInput: {
      serviceSlug: "regular-cleaning" as const,
      bedrooms: 2,
      bathrooms: 1,
      teamSize: 1,
    },
    cleanerPreference: { mode: "best_available" as const, selectedCleanerId: null },
    preferredCleanerId: null,
  };
}

async function seedOfferWithPath(
  backend: InMemoryBookingCommandBackend,
  bookingId: string,
  path: "best_available" | "fallback_best_available" | "selected",
  cleanerId: string,
): Promise<string> {
  const offerResult = await createDispatchOffer(backend, {
    bookingId,
    cleanerId,
    expiresAt: buildOfferExpiresAt(),
  });
  if (!offerResult.ok) throw new Error("offer failed");
  const offerId = [...backend.offers.values()].find(
    (o) => o.booking_id === bookingId && o.cleaner_id === cleanerId,
  )!.id;

  await executeBookingCommand(
    backend,
    {
      type: "RECORD_ASSIGNMENT_ATTENTION",
      actor: systemActor,
      bookingId,
      assignment: {
        engineVersion: "2026-05-16-phase8",
        status: "offered",
        path,
        cleanerId,
        offerId,
        reason: null,
        attemptedAt: new Date().toISOString(),
      },
      idempotencyKey: `assignment:meta:${bookingId}:offered:${path}`,
    },
    {},
  );

  return offerId;
}

describe("processBookingAfterOfferEnded — decline", () => {
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

  it("best_available decline redispatches to another eligible cleaner", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = await seedOfferWithPath(backend, bookingId, "best_available", cleanerA);
    const offer = backend.offers.get(offerId)!;

    contextMock.loadAssignmentContext.mockResolvedValue(mockAssignmentContext(bookingId));
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockResolvedValue(cleanerB);

    const declined = await declineCleanerOffer(backend, offer, cleanerA, cleanerProfileA);
    expect(declined.ok).toBe(true);

    const client = createOffersClient(backend);
    await handleOfferDeclinedFollowUp(client, backend, { ...offer, status: "declined" });

    const open = [...backend.offers.values()].filter(
      (o) => o.booking_id === bookingId && isOfferOpenForOps(o, now),
    );
    expect(open).toHaveLength(1);
    expect(open[0]?.cleaner_id).toBe(cleanerB);

    const booking = await backend.getBooking(bookingId);
    const meta = readAssignmentMetadata(booking?.metadata);
    expect(meta?.path).toBe("best_available");
    expect(meta?.status).toBe("offered");
  });

  it("fallback_best_available decline redispatches", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = await seedOfferWithPath(
      backend,
      bookingId,
      "fallback_best_available",
      cleanerA,
    );
    const offer = backend.offers.get(offerId)!;

    contextMock.loadAssignmentContext.mockResolvedValue(mockAssignmentContext(bookingId));
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockResolvedValue(cleanerB);

    await declineCleanerOffer(backend, offer, cleanerA, cleanerProfileA);

    const client = createOffersClient(backend);
    await handleOfferDeclinedFollowUp(client, backend, { ...offer, status: "declined" });

    const meta = readAssignmentMetadata((await backend.getBooking(bookingId))?.metadata);
    expect(meta?.path).toBe("fallback_best_available");
    expect(meta?.status).toBe("offered");
    expect(
      [...backend.offers.values()].filter((o) => o.status === "offered" && o.cleaner_id === cleanerB),
    ).toHaveLength(1);
  });

  it("selected cleaner decline does not redispatch and records attention", async () => {
    const bookingId = await paidPendingBooking(backend, {
      preferred_cleaner_id: cleanerA,
      cleanerPreferenceMode: "selected",
    });
    const offerId = await seedOfferWithPath(backend, bookingId, "selected", cleanerA);
    const offer = backend.offers.get(offerId)!;

    await declineCleanerOffer(backend, offer, cleanerA, cleanerProfileA);

    const client = createOffersClient(backend);
    await handleOfferDeclinedFollowUp(client, backend, { ...offer, status: "declined" });

    expect([...backend.offers.values()].filter((o) => o.status === "offered")).toHaveLength(0);

    const meta = readAssignmentMetadata((await backend.getBooking(bookingId))?.metadata);
    expect(meta?.path).toBe("selected");
    expect(meta?.status).toBe("attention_required");
    expect(meta?.reason).toContain("selected cleaner");
  });

  it("max attempts decline records attention without new offer", async () => {
    const bookingId = await paidPendingBooking(backend);
    contextMock.loadAssignmentContext.mockResolvedValue(mockAssignmentContext(bookingId));

    const ts = now.toISOString();
    for (let i = 0; i < ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING - 1; i++) {
      const id = `declined-offer-${i}`;
      backend.offers.set(
        id,
        testAssignmentOfferRow({
          id,
          booking_id: bookingId,
          cleaner_id: i === 0 ? cleanerA : cleanerB,
          status: "declined",
          offered_at: ts,
          expires_at: buildOfferExpiresAt(now),
          responded_at: ts,
          created_at: ts,
          updated_at: ts,
        }),
      );
    }

    const lastId = "offer-last";
    backend.offers.set(
      lastId,
      testAssignmentOfferRow({
        id: lastId,
        booking_id: bookingId,
        cleaner_id: cleanerC,
        status: "offered",
        offered_at: ts,
        expires_at: buildOfferExpiresAt(now),
        created_at: ts,
        updated_at: ts,
      }),
    );

    const lastOffer = backend.offers.get(lastId)!;

    await executeBookingCommand(
      backend,
      {
        type: "RECORD_ASSIGNMENT_ATTENTION",
        actor: systemActor,
        bookingId,
        assignment: {
          engineVersion: "2026-05-16-phase8",
          status: "offered",
          path: "best_available",
          cleanerId: lastOffer.cleaner_id,
          offerId: lastOffer.id,
          reason: null,
          attemptedAt: now.toISOString(),
        },
        idempotencyKey: `assignment:meta:${bookingId}:offered:best_available`,
      },
      {},
    );

    await declineCleanerOffer(backend, lastOffer, lastOffer.cleaner_id, cleanerProfileA);

    const client = createOffersClient(backend);
    await handleOfferDeclinedFollowUp(client, backend, {
      ...lastOffer,
      status: "declined",
    });

    expect([...backend.offers.values()].filter((o) => o.status === "offered")).toHaveLength(0);
    const meta = readAssignmentMetadata((await backend.getBooking(bookingId))?.metadata);
    expect(meta?.status).toBe("attention_required");
    expect(meta?.reason).toContain("Maximum assignment dispatch attempts");
  });

  it("repeated decline follow-up does not duplicate offers when open offer exists", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = await seedOfferWithPath(backend, bookingId, "best_available", cleanerA);
    const offer = backend.offers.get(offerId)!;

    contextMock.loadAssignmentContext.mockResolvedValue(mockAssignmentContext(bookingId));
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockResolvedValue(cleanerB);

    await declineCleanerOffer(backend, offer, cleanerA, cleanerProfileA);
    const client = createOffersClient(backend);
    await handleOfferDeclinedFollowUp(client, backend, { ...offer, status: "declined" });

    const offeredBefore = [...backend.offers.values()].filter((o) => o.status === "offered").length;

    await processBookingAfterOfferEnded(client, backend, {
      bookingId,
      outcome: "declined",
      endedOfferId: offer.id,
      endedCleanerId: cleanerA,
      now,
    });

    expect([...backend.offers.values()].filter((o) => o.status === "offered")).toHaveLength(
      offeredBefore,
    );
  });

  it("declined cleaner is excluded from redispatch pick", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = await seedOfferWithPath(backend, bookingId, "best_available", cleanerA);
    const offer = backend.offers.get(offerId)!;

    contextMock.loadAssignmentContext.mockResolvedValue(mockAssignmentContext(bookingId));
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockImplementation(
      async (_client, _ctx, exclude) => {
        expect(exclude.has(cleanerA)).toBe(true);
        return cleanerB;
      },
    );

    await declineCleanerOffer(backend, offer, cleanerA, cleanerProfileA);
    const client = createOffersClient(backend);
    await handleOfferDeclinedFollowUp(client, backend, { ...offer, status: "declined" });

    expect(eligibilityMock.pickBestEligibleCleanerIdExcluding).toHaveBeenCalled();
  });
});

describe("processBookingAfterOfferEnded — expiry wrapper unchanged", () => {
  let backend: InMemoryBookingCommandBackend;
  const now = new Date("2026-05-18T12:00:00.000Z");

  beforeEach(() => {
    backend = new InMemoryBookingCommandBackend();
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockReset();
    contextMock.loadAssignmentContext.mockReset();
  });

  it("processBookingAfterOfferExpiry delegates to shared orchestrator for selected", async () => {
    const bookingId = await paidPendingBooking(backend);
    const offerId = crypto.randomUUID();
    backend.offers.set(
      offerId,
      testAssignmentOfferRow({
        id: offerId,
        booking_id: bookingId,
        cleaner_id: cleanerA,
        status: "expired",
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
        actor: systemActor,
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

    const client = createOffersClient(backend);
    const result = await processBookingAfterOfferExpiry(client, backend, bookingId, now);
    expect(result.attentionRequired).toBe(true);
    expect(result.redispatched).toBe(false);
    const meta = readAssignmentMetadata((await backend.getBooking(bookingId))?.metadata);
    expect(meta?.reason).toContain("selected cleaner");
  });

  it("expireStaleAssignmentOffers still auto-redispatches best_available", async () => {
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
        actor: systemActor,
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

    contextMock.loadAssignmentContext.mockResolvedValue(mockAssignmentContext(bookingId));
    eligibilityMock.pickBestEligibleCleanerIdExcluding.mockResolvedValue(cleanerB);

    const client = createOffersClient(backend);
    const result = await expireStaleAssignmentOffers(client, backend, now);
    expect(result.redispatchedBookingIds).toContain(bookingId);
  });
});
