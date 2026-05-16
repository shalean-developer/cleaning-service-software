import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import { InMemoryLockStore } from "./inMemoryLockStore";
import type { CurrentUser } from "@/lib/auth/types";

const validateCleanerMock = vi.fn();
const runBackendMock = vi.fn();

vi.mock("./validateCleanerPreference", () => ({
  validateCleanerPreferenceForLock: () => validateCleanerMock(),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => runBackendMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: vi.fn(async () => ({ actingCustomerId: "customer-1" })),
}));

const lockStore = new InMemoryLockStore();

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => ({}),
}));

vi.mock("./lockRepository", () => ({
  findLockByIdempotencyKey: async (_c: unknown, key: string) =>
    lockStore.findByIdempotencyKey(key),
  findActiveLockByBookingId: async (_c: unknown, bookingId: string) =>
    lockStore.findActiveByBookingId(bookingId),
  findLockById: async (_c: unknown, id: string) => lockStore.findById(id),
  insertBookingLock: async (
    _c: unknown,
    params: Parameters<InMemoryLockStore["insert"]>[0],
  ) => lockStore.insert(params),
  markLockConsumed: async (_c: unknown, id: string) => lockStore.markConsumed(id),
  markLockExpired: async (_c: unknown, id: string) => lockStore.markExpired(id),
  isLockExpired: (lock: { expires_at: string; status: string }) => {
    if (lock.status === "expired") return true;
    return new Date(lock.expires_at).getTime() <= Date.now();
  },
}));

const customerUser: CurrentUser = {
  profileId: "profile-1",
  role: "customer",
  authUser: { id: "profile-1", email: "c@test.com" } as CurrentUser["authUser"],
};

const adminUser: CurrentUser = {
  profileId: "admin-1",
  role: "admin",
  authUser: { id: "admin-1", email: "a@test.com" } as CurrentUser["authUser"],
};

const pricingInput = {
  serviceSlug: "regular-cleaning" as const,
  bedrooms: 2,
  bathrooms: 1,
};

async function seedPaymentFailedBooking(
  backend: InMemoryBookingCommandBackend,
  customerId: string,
  priceCents: number,
): Promise<string> {
  const quote = calculateQuote(pricingInput);
  if (!quote.ok) throw new Error("quote failed");

  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: { actorType: "system", profileId: null },
      customerId,
      scheduledStart: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      scheduledEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      priceCents,
      metadata: buildBookingQuoteMetadata(pricingInput, quote.breakdown),
    },
    { actingCustomerId: customerId },
  );
  if (!draft.ok) throw new Error("draft failed");
  const bookingId = draft.bookingId;
  const booking = backend.bookings.get(bookingId)!;
  booking.metadata = {
    ...buildBookingQuoteMetadata(pricingInput, quote.breakdown),
    suburb: "Sea Point",
  };
  backend.bookings.set(bookingId, booking);

  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: { actorType: "customer", profileId: "profile-1" },
      bookingId,
      paymentIdempotencyKey: "pay:seed:1",
    },
    { actingCustomerId: customerId },
  );

  const payment = [...backend.payments.values()].find((p) => p.booking_id === bookingId)!;
  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_FAILED",
      actor: { actorType: "system", profileId: null },
      bookingId,
      paymentId: payment.id,
    },
    {},
  );

  return bookingId;
}

describe("createPaymentRetryLock", () => {
  let backend: InMemoryBookingCommandBackend;

  beforeEach(() => {
    lockStore.locks.clear();
    backend = new InMemoryBookingCommandBackend();
    runBackendMock.mockReturnValue(backend);
    validateCleanerMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates retry lock for own payment_failed booking without new booking", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );
    const bookingCountBefore = backend.bookings.size;

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const result = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:attempt-1`,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bookingId).toBe(bookingId);
    expect(result.idempotent).toBe(false);
    expect(backend.bookings.size).toBe(bookingCountBefore);
    expect(lockStore.locks.size).toBe(1);
    const lock = [...lockStore.locks.values()][0]!;
    expect(lock.booking_id).toBe(bookingId);
    expect(lock.status).toBe("active");
  });

  it("forbids non-owner customer", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );

    const { resolveActorScope } = await import("@/lib/auth/resolveActorScope");
    vi.mocked(resolveActorScope).mockResolvedValueOnce({
      actingCustomerId: "customer-other",
    });

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const result = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:other`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });

  it("rejects admin", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const result = await createPaymentRetryLock(adminUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:admin`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });

  it("rejects confirmed booking", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );
    const booking = backend.bookings.get(bookingId)!;
    booking.status = "confirmed";
    backend.bookings.set(bookingId, booking);

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const result = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:confirmed`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RETRY_NOT_ELIGIBLE");
  });

  it("rejects booking with paid payment", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );
    const booking = backend.bookings.get(bookingId)!;
    booking.status = "payment_failed";
    backend.bookings.set(bookingId, booking);
    await backend.insertPayment({
      id: crypto.randomUUID(),
      booking_id: bookingId,
      status: "paid",
      provider: "paystack",
      provider_ref: "paid-ref",
      idempotency_key: "pay:paid:extra",
      amount_cents: booking.price_cents,
      currency: "ZAR",
      payment_link_expires_at: null,
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const result = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:paid`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RETRY_NOT_ELIGIBLE");
  });

  it("rejects missing quote metadata", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );
    const booking = backend.bookings.get(bookingId)!;
    booking.metadata = { suburb: "Sea Point" };
    backend.bookings.set(bookingId, booking);

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const result = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:no-quote`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RETRY_NOT_SUPPORTED");
  });

  it("rejects stale quote as QUOTE_STALE", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents + 10_000,
    );

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const result = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:stale`,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("QUOTE_STALE");
  });

  it("returns same lock on repeated idempotency key", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );
    const key = `retry:${bookingId}:same`;

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const first = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: key,
    });
    const second = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: key,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.idempotent).toBe(true);
    expect(second.lockId).toBe(first.lockId);
    expect(lockStore.locks.size).toBe(1);
  });

  it("returns ACTIVE_LOCK_EXISTS for different key while active lock remains", async () => {
    const quote = calculateQuote(pricingInput);
    if (!quote.ok) throw new Error("quote");
    const bookingId = await seedPaymentFailedBooking(
      backend,
      "customer-1",
      quote.breakdown.totalCents,
    );

    const { createPaymentRetryLock } = await import("./createPaymentRetryLock");
    const first = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:a`,
    });
    expect(first.ok).toBe(true);

    const second = await createPaymentRetryLock(customerUser, bookingId, {
      checkoutIdempotencyKey: `retry:${bookingId}:b`,
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("ACTIVE_LOCK_EXISTS");
  });
});
