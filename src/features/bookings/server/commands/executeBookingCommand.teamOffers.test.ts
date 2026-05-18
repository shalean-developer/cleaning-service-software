import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBookingCommand } from "./executeBookingCommand";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";
import { offerTeamRole } from "@/features/assignments/server/offerTeamRole";

const systemActor = { actorType: "system" as const, profileId: null };
const cleanerActor = (profileId: string) =>
  ({ actorType: "cleaner" as const, profileId }) as const;

async function seedPendingAssignmentBooking(
  backend: InMemoryBookingCommandBackend,
  custId: string,
): Promise<string> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: { actorType: "admin" as const, profileId: "admin" },
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
      actor: { actorType: "admin" as const, profileId: "admin" },
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

describe("executeBookingCommand NF-7D team offers", () => {
  beforeEach(() => {
    vi.stubEnv("TEAM_OFFERS_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows primary and support open offers on the same booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "team-coexist");
    const primary = "cleaner-primary";
    const support = "cleaner-support";

    const first = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: primary,
        teamRole: "primary",
      },
      {},
    );
    expect(first.ok).toBe(true);

    const second = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: support,
        teamRole: "support",
      },
      {},
    );
    expect(second.ok).toBe(true);

    const open = [...backend.offers.values()].filter((o) => o.status === "offered");
    expect(open).toHaveLength(2);
    expect(open.map((o) => offerTeamRole(o)).sort()).toEqual(["primary", "support"]);
  });

  it("accepting primary mirrors bookings.cleaner_id and syncs roster", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "primary-mirror");
    const primary = "cleaner-primary";
    const profile = "profile-primary";

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: primary,
        teamRole: "primary",
      },
      {},
    );
    const offerId = [...backend.offers.values()].find(
      (o) => offerTeamRole(o) === "primary",
    )!.id;

    const accept = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor(profile),
        bookingId,
        offerId,
      },
      { actingCleanerId: primary },
    );
    expect(accept.ok).toBe(true);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.cleaner_id).toBe(primary);
    expect(booking?.status).toBe("assigned");

    const roster = await backend.listBookingCleanersForBooking(bookingId);
    expect(roster.some((r) => r.role === "primary" && r.status === "accepted")).toBe(true);
  });

  it("accepting support does not overwrite bookings.cleaner_id", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "support-no-mirror");
    const primary = "cleaner-primary";
    const support = "cleaner-support";

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: primary,
        teamRole: "primary",
      },
      {},
    );
    const primaryOfferId = [...backend.offers.values()].find(
      (o) => offerTeamRole(o) === "primary",
    )!.id;
    await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor("p-primary"),
        bookingId,
        offerId: primaryOfferId,
      },
      { actingCleanerId: primary },
    );

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: support,
        teamRole: "support",
      },
      {},
    );
    const supportOfferId = [...backend.offers.values()].find(
      (o) => offerTeamRole(o) === "support" && o.status === "offered",
    )!.id;

    const acceptSupport = await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor("p-support"),
        bookingId,
        offerId: supportOfferId,
      },
      { actingCleanerId: support },
    );
    expect(acceptSupport.ok).toBe(true);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.cleaner_id).toBe(primary);
    expect(booking?.status).toBe("assigned");

    const roster = await backend.listBookingCleanersForBooking(bookingId);
    expect(roster.some((r) => r.role === "support" && r.status === "accepted")).toBe(true);
  });

  it("declining support updates roster only without booking status change", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "support-decline");
    const primary = "cleaner-primary";
    const support = "cleaner-support";

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: primary,
        teamRole: "primary",
      },
      {},
    );
    const primaryOfferId = [...backend.offers.values()].find(
      (o) => offerTeamRole(o) === "primary",
    )!.id;
    await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: cleanerActor("p-primary"),
        bookingId,
        offerId: primaryOfferId,
      },
      { actingCleanerId: primary },
    );

    await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: support,
        teamRole: "support",
      },
      {},
    );
    const supportOfferId = [...backend.offers.values()].find(
      (o) => offerTeamRole(o) === "support",
    )!.id;

    const decline = await executeBookingCommand(
      backend,
      {
        type: "DECLINE_CLEANER_ASSIGNMENT",
        actor: cleanerActor("p-support"),
        bookingId,
        offerId: supportOfferId,
      },
      { actingCleanerId: support },
    );
    expect(decline.ok).toBe(true);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("assigned");
    expect(booking?.cleaner_id).toBe(primary);

    const roster = await backend.listBookingCleanersForBooking(bookingId);
    const supportRow = roster.find((r) => r.role === "support");
    expect(supportRow?.status).toBe("declined");
  });
});

describe("executeBookingCommand NF-7D flag disabled", () => {
  beforeEach(() => {
    vi.stubEnv("TEAM_OFFERS_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks support offers when TEAM_OFFERS_ENABLED is false", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "flag-off");

    const result = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: "cleaner-support",
        teamRole: "support",
      },
      {},
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("FORBIDDEN");
  });

  it("preserves legacy one-open-offer-per-booking when flag disabled", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend, "legacy-one");
    const cleanerA = "cleaner-a";
    const cleanerB = "cleaner-b";

    const first = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerA,
      },
      {},
    );
    expect(first.ok).toBe(true);

    const second = await executeBookingCommand(
      backend,
      {
        type: "OFFER_TO_CLEANER",
        actor: systemActor,
        bookingId,
        cleanerId: cleanerB,
      },
      {},
    );
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("expected failure");
    expect(second.code).toBe("OPEN_OFFER_EXISTS");
  });
});
