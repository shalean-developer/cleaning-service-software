import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CleanerLifecycleSnapshot } from "@/features/cleaners/server/lifecycle/operationalState";
import { executeBookingCommand } from "./executeBookingCommand";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";

const systemActor = { actorType: "system" as const, profileId: null };
const adminActor = { actorType: "admin" as const, profileId: "admin-profile" };
const cleanerActor = (profileId: string) =>
  ({ actorType: "cleaner" as const, profileId }) as const;

const NOW = new Date("2026-05-19T12:00:00.000Z");

function operationalSnapshot(
  overrides: Partial<CleanerLifecycleSnapshot> = {},
): CleanerLifecycleSnapshot {
  return {
    active: true,
    suspendedAt: null,
    deletedAt: null,
    onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function seedPendingAssignmentBooking(
  backend: InMemoryBookingCommandBackend,
  custId: string,
): Promise<string> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: adminActor,
      customerId: custId,
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
      priceCents: 8000,
    },
    {},
  );
  if (!draft.ok) throw new Error("draft");
  const bookingId = draft.bookingId;
  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: adminActor,
      bookingId,
      paymentIdempotencyKey: `pay-${custId}`,
    },
    {},
  );
  await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId,
      paymentId: [...backend.payments.values()][0]!.id,
      idempotencyKey: `finalize-${custId}`,
    },
    {},
  );
  await executeBookingCommand(
    backend,
    { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
    {},
  );
  return bookingId;
}

async function offerToCleaner(
  backend: InMemoryBookingCommandBackend,
  bookingId: string,
  cleanerId: string,
) {
  return executeBookingCommand(
    backend,
    {
      type: "OFFER_TO_CLEANER",
      actor: systemActor,
      bookingId,
      cleanerId,
    },
    {},
  );
}

describe("executeBookingCommand cleaner lifecycle offer guards", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows active cleaner to receive and accept an offer", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const cleanerId = "cleaner-active";
    const profileId = "profile-active";
    backend.setCleanerLifecycle(cleanerId, operationalSnapshot());

    const bookingId = await seedPendingAssignmentBooking(backend, "cust-active");
    const offerResult = await offerToCleaner(backend, bookingId, cleanerId);
    expect(offerResult.ok).toBe(true);

    const offerId = [...backend.offers.values()][0]!.id;
    const accept = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor(profileId),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerId },
    );
    expect(accept.ok).toBe(true);
  });

  it.each([
    ["inactive", operationalSnapshot({ active: false })],
    ["suspended", operationalSnapshot({ suspendedAt: "2026-05-18T00:00:00.000Z" })],
    ["onboarding", operationalSnapshot({ onboardingCompletedAt: null })],
    [
      "archived",
      operationalSnapshot({
        deletedAt: "2026-01-01T00:00:00.000Z",
        active: false,
      }),
    ],
  ] as const)(
    "blocks %s cleaner from receiving an offer",
    async (_label, snapshot) => {
      const backend = new InMemoryBookingCommandBackend();
      const cleanerId = `cleaner-${_label}`;
      backend.setCleanerLifecycle(cleanerId, snapshot);

      const bookingId = await seedPendingAssignmentBooking(
        backend,
        `cust-offer-${_label}`,
      );
      const offer = await offerToCleaner(backend, bookingId, cleanerId);
      expect(offer.ok).toBe(false);
      if (offer.ok) throw new Error("expected failure");
      expect(offer.code).toBe("CLEANER_NOT_OPERATIONAL");
      expect([...backend.offers.values()]).toHaveLength(0);
    },
  );

  it.each([
    ["inactive", operationalSnapshot({ active: false })],
    ["suspended", operationalSnapshot({ suspendedAt: "2026-05-18T00:00:00.000Z" })],
    ["onboarding", operationalSnapshot({ onboardingCompletedAt: null })],
    [
      "archived",
      operationalSnapshot({
        deletedAt: "2026-01-01T00:00:00.000Z",
        active: false,
      }),
    ],
  ] as const)(
    "blocks %s cleaner from accepting an existing offer",
    async (_label, snapshot) => {
      const backend = new InMemoryBookingCommandBackend();
      const cleanerId = `cleaner-accept-${_label}`;
      const profileId = `profile-accept-${_label}`;
      backend.setCleanerLifecycle(cleanerId, operationalSnapshot());

      const bookingId = await seedPendingAssignmentBooking(
        backend,
        `cust-accept-${_label}`,
      );
      const offerResult = await offerToCleaner(backend, bookingId, cleanerId);
      expect(offerResult.ok).toBe(true);
      const offerId = [...backend.offers.values()][0]!.id;

      backend.setCleanerLifecycle(cleanerId, snapshot);

      const accept = await executeBookingCommand(
        backend,
        {
          type: "ACCEPT_CLEANER_ASSIGNMENT",
          actor: cleanerActor(profileId),
          bookingId,
          offerId,
        },
        { actingCleanerId: cleanerId },
      );
      expect(accept.ok).toBe(false);
      if (accept.ok) throw new Error("expected failure");
      expect(accept.code).toBe("CLEANER_NOT_OPERATIONAL");

      const booking = await backend.getBooking(bookingId);
      expect(booking?.status).toBe("pending_assignment");
    },
  );

  it.each([
    ["inactive", operationalSnapshot({ active: false })],
    ["suspended", operationalSnapshot({ suspendedAt: "2026-05-18T00:00:00.000Z" })],
  ] as const)(
    "allows %s cleaner to decline an existing offer",
    async (_label, snapshot) => {
      const backend = new InMemoryBookingCommandBackend();
      const cleanerId = `cleaner-decline-${_label}`;
      const profileId = `profile-decline-${_label}`;
      backend.setCleanerLifecycle(cleanerId, operationalSnapshot());

      const bookingId = await seedPendingAssignmentBooking(
        backend,
        `cust-decline-${_label}`,
      );
      const offerResult = await offerToCleaner(backend, bookingId, cleanerId);
      expect(offerResult.ok).toBe(true);
      const offerId = [...backend.offers.values()][0]!.id;

      backend.setCleanerLifecycle(cleanerId, snapshot);

      const decline = await executeBookingCommand(
        backend,
        {
          type: "DECLINE_CLEANER_ASSIGNMENT",
          actor: cleanerActor(profileId),
          bookingId,
          offerId,
        },
        { actingCleanerId: cleanerId },
      );
      expect(decline.ok).toBe(true);
      expect(backend.offers.get(offerId)?.status).toBe("declined");
    },
  );

  it("allows idempotent accept replay when cleaner is no longer operational", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const cleanerId = "cleaner-idempotent-accept";
    const profileId = "profile-idempotent-accept";
    backend.setCleanerLifecycle(cleanerId, operationalSnapshot());

    const bookingId = await seedPendingAssignmentBooking(backend, "cust-idempotent");
    await offerToCleaner(backend, bookingId, cleanerId);
    const offerId = [...backend.offers.values()][0]!.id;

    const firstAccept = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor(profileId),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerId },
    );
    expect(firstAccept.ok).toBe(true);

    backend.setCleanerLifecycle(cleanerId, operationalSnapshot({ active: false }));

    const replay = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor(profileId),
        bookingId,
        offerId,
      },
      { actingCleanerId: cleanerId },
    );
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error("expected idempotent accept");
    expect(replay.idempotent).toBe(true);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("assigned");
  });

  it("allows idempotent offer replay when cleaner is no longer operational", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const cleanerId = "cleaner-idempotent-offer";
    backend.setCleanerLifecycle(cleanerId, operationalSnapshot());

    const bookingId = await seedPendingAssignmentBooking(
      backend,
      "cust-idempotent-offer",
    );
    const first = await offerToCleaner(backend, bookingId, cleanerId);
    expect(first.ok).toBe(true);

    backend.setCleanerLifecycle(cleanerId, operationalSnapshot({ active: false }));

    const replay = await offerToCleaner(backend, bookingId, cleanerId);
    expect(replay.ok).toBe(true);
    if (!replay.ok) throw new Error("expected idempotent offer");
    expect(replay.idempotent).toBe(true);
    expect([...backend.offers.values()].filter((o) => o.status === "offered")).toHaveLength(
      1,
    );
  });
});
