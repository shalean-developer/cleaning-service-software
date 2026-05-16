import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { buildOfferExpiresAt, isOfferPastExpiry } from "./buildOfferExpiry";
import { createDispatchOffer } from "./createDispatchOffer";
import { runAssignmentAfterPayment } from "./runAssignmentAfterPayment";
import { acceptCleanerOffer, declineCleanerOffer } from "./respondToOffer";
import type { AssignmentContext } from "./types";

const eligibilityMock = vi.hoisted(() => ({
  isCleanerEligibleForAssignment: vi.fn(),
  pickBestEligibleCleanerId: vi.fn(),
}));

vi.mock("./eligibilityForAssignment", () => eligibilityMock);

vi.mock("./assignmentContext", () => ({
  loadAssignmentContext: vi.fn(),
}));

vi.mock("./offerRepository", () => ({
  listOffersForBooking: vi.fn(async () => []),
}));

const systemActor = { actorType: "system" as const, profileId: null };
const customerId = "customer-1";
const cleanerA = "cleaner-a";
const cleanerB = "cleaner-b";
const cleanerProfileA = "profile-cleaner-a";

let backend: InMemoryBookingCommandBackend;

async function paidBooking(
  metadata: Record<string, unknown> = {},
  priceCents = 53_000,
): Promise<string> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
      priceCents,
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
  const fin = await executeBookingCommand(
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
  if (!fin.ok) throw new Error("finalize failed");
  return draft.bookingId;
}

const baseContext: AssignmentContext = {
  bookingId: "placeholder",
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
};

describe("assignment engine", () => {
  beforeEach(() => {
    backend = new InMemoryBookingCommandBackend();
    eligibilityMock.isCleanerEligibleForAssignment.mockReset();
    eligibilityMock.pickBestEligibleCleanerId.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates offer for selected eligible cleaner", async () => {
    const bookingId = await paidBooking({
      preferred_cleaner_id: cleanerA,
      cleanerPreferenceMode: "selected",
    });

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({
      ...baseContext,
      bookingId,
      cleanerPreference: { mode: "selected", selectedCleanerId: cleanerA },
      preferredCleanerId: cleanerA,
    });
    eligibilityMock.isCleanerEligibleForAssignment.mockResolvedValue(true);

    const result = await runAssignmentAfterPayment({} as never, backend, bookingId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("offered");
    expect(result.cleanerId).toBe(cleanerA);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_assignment");
    expect(booking?.status).not.toBe("confirmed");
  });

  it("does not offer to ineligible selected cleaner without fallback", async () => {
    const bookingId = await paidBooking({
      preferred_cleaner_id: cleanerA,
      cleanerPreferenceMode: "selected",
    });

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({
      ...baseContext,
      bookingId,
      cleanerPreference: { mode: "selected", selectedCleanerId: cleanerA },
      preferredCleanerId: cleanerA,
    });
    eligibilityMock.isCleanerEligibleForAssignment.mockResolvedValue(false);
    eligibilityMock.pickBestEligibleCleanerId.mockResolvedValue(null);

    const result = await runAssignmentAfterPayment({} as never, backend, bookingId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("attention_required");
    expect([...backend.offers.values()]).toHaveLength(0);
  });

  it("best available picks deterministic cleaner", async () => {
    const bookingId = await paidBooking({ cleanerPreferenceMode: "best_available" });

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({
      ...baseContext,
      bookingId,
    });
    eligibilityMock.pickBestEligibleCleanerId.mockResolvedValue(cleanerB);

    const first = await runAssignmentAfterPayment({} as never, backend, bookingId);
    const second = await runAssignmentAfterPayment({} as never, backend, bookingId);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.idempotent).toBe(true);
    expect([...backend.offers.values()]).toHaveLength(1);
    expect([...backend.offers.values()][0]!.cleaner_id).toBe(cleanerB);
  });

  it("cleaner can accept own offer and booking becomes assigned", async () => {
    const bookingId = await paidBooking();
    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );

    const offerResult = await createDispatchOffer(backend, {
      bookingId,
      cleanerId: cleanerA,
      expiresAt: buildOfferExpiresAt(),
    });
    expect(offerResult.ok).toBe(true);
    const offer = [...backend.offers.values()][0]!;

    const accept = await acceptCleanerOffer(
      backend,
      offer,
      cleanerA,
      cleanerProfileA,
    );
    expect(accept.ok).toBe(true);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("assigned");
    expect(booking?.cleaner_id).toBe(cleanerA);
  });

  it("cleaner cannot accept another cleaners offer", async () => {
    const bookingId = await paidBooking();
    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: cleanerA,
      expiresAt: buildOfferExpiresAt(),
    });
    const offer = [...backend.offers.values()][0]!;

    const accept = await acceptCleanerOffer(backend, offer, cleanerB, "profile-b");
    expect(accept.ok).toBe(false);
    if (accept.ok) return;
    expect(accept.code).toBe("FORBIDDEN");
  });

  it("expired offer cannot be accepted", async () => {
    const bookingId = await paidBooking();
    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: cleanerA,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const offer = [...backend.offers.values()][0]!;
    expect(isOfferPastExpiry(offer.expires_at)).toBe(true);

    const accept = await acceptCleanerOffer(
      backend,
      offer,
      cleanerA,
      cleanerProfileA,
    );
    expect(accept.ok).toBe(false);
    if (accept.ok) return;
    expect(accept.code).toBe("OFFER_NOT_OPEN");
  });

  it("duplicate accept is idempotent", async () => {
    const bookingId = await paidBooking();
    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: cleanerA,
      expiresAt: buildOfferExpiresAt(),
    });
    const offer = [...backend.offers.values()][0]!;

    const first = await acceptCleanerOffer(
      backend,
      offer,
      cleanerA,
      cleanerProfileA,
    );
    const second = await acceptCleanerOffer(
      backend,
      offer,
      cleanerA,
      cleanerProfileA,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);
    expect([...backend.bookings.values()].filter((b) => b.status === "assigned")).toHaveLength(
      1,
    );
  });

  it("decline keeps booking unassigned for redispatch", async () => {
    const bookingId = await paidBooking();
    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: cleanerA,
      expiresAt: buildOfferExpiresAt(),
    });
    const offer = [...backend.offers.values()][0]!;

    const declined = await declineCleanerOffer(
      backend,
      offer,
      cleanerA,
      cleanerProfileA,
    );
    expect(declined.ok).toBe(true);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_assignment");
    expect(booking?.cleaner_id).toBeNull();
    const updated = await backend.getOffer(offer.id);
    expect(updated?.status).toBe("declined");
  });

  it("payment remains confirmed when assignment dispatch fails", async () => {
    const bookingId = await paidBooking();
    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue(null);

    const result = await runAssignmentAfterPayment({} as never, backend, bookingId);
    expect(result.ok).toBe(false);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("confirmed");
    expect(booking?.metadata).toBeTruthy();
    const paid = [...backend.payments.values()].some((p) => p.status === "paid");
    expect(paid).toBe(true);
  });
});
