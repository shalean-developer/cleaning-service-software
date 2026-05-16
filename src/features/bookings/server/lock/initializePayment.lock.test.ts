import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingLockRow } from "@/lib/database/types";
import type { CurrentUser } from "@/lib/auth/types";

const hoisted = vi.hoisted(() => ({
  paystackInitMock: vi.fn(),
  assertLockMock: vi.fn(),
  markConsumedMock: vi.fn(),
  customerId: "",
}));

vi.mock("@/features/payments/server/paystackClient", () => ({
  paystackInitializeTransaction: (...args: unknown[]) => hoisted.paystackInitMock(...args),
  PaystackApiError: class extends Error {},
}));

vi.mock("@/features/payments/server/paystackEnv", () => ({
  isPaystackEnabled: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({}),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: async () => ({ actingCustomerId: hoisted.customerId }),
}));

vi.mock("./assertActiveLock", () => ({
  assertActiveBookingLock: (...args: unknown[]) => hoisted.assertLockMock(...args),
  assertBookingMatchesLock: () => null,
}));

vi.mock("./lockRepository", () => ({
  markLockConsumed: (...args: unknown[]) => hoisted.markConsumedMock(...args),
}));

let backend: InMemoryBookingCommandBackend;

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => backend,
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "payments") {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

vi.mock("@/features/payments/server/paymentRepository", () => ({
  findPaymentByIdempotencyKey: async (_c: unknown, key: string) =>
    backend.findPaymentByIdempotencyKey(key),
  getPaymentById: async (_c: unknown, id: string) => backend.getPayment(id),
  updatePaymentProviderRef: async () => {},
}));

const user: CurrentUser = {
  profileId: "profile-1",
  role: "customer",
  authUser: { id: "profile-1", email: "c@test.com" } as CurrentUser["authUser"],
};

describe("initializePayment with booking lock", () => {
  beforeEach(async () => {
    process.env.BOOKING_LOCK_REQUIRED = "true";
    process.env.APP_BASE_URL = "http://localhost:3000";
    backend = new InMemoryBookingCommandBackend();
    hoisted.customerId = crypto.randomUUID();
    hoisted.markConsumedMock.mockResolvedValue(undefined);

    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: { actorType: "system", profileId: null },
        customerId: hoisted.customerId,
        scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
        scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
        priceCents: 59_000,
        currency: "ZAR",
      },
      { actingCustomerId: hoisted.customerId },
    );
    if (!draft.ok) throw new Error("draft failed");

    const booking = await backend.getBooking(draft.bookingId);
    if (!booking) throw new Error("no booking");
    Object.assign(booking, { customer_id: hoisted.customerId });
    backend.bookings.set(booking.id, booking);

    const lock: BookingLockRow = {
      id: "lock-1",
      booking_id: draft.bookingId,
      customer_id: hoisted.customerId,
      idempotency_key: "checkout:test",
      status: "active",
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 1_800_000).toISOString(),
      locked_price_cents: 59_000,
      locked_currency: "ZAR",
      locked_service_slug: "regular-cleaning",
      locked_schedule_start: booking.scheduled_start,
      locked_schedule_end: booking.scheduled_end,
      locked_schedule_timezone: "Africa/Johannesburg",
      locked_area_slug: "cape-town",
      locked_cleaner_preference: { mode: "best_available" },
      locked_metadata: {},
      client_quote_total_cents: 59_000,
      inputs_hash: "hash",
      lock_version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    hoisted.assertLockMock.mockResolvedValue({ ok: true, lock });
    hoisted.paystackInitMock.mockResolvedValue({
      data: {
        authorization_url: "https://paystack.test/pay",
        access_code: "code",
        reference: "ref-1",
      },
    });
  });

  afterEach(() => {
    delete process.env.BOOKING_LOCK_REQUIRED;
    delete process.env.APP_BASE_URL;
    vi.clearAllMocks();
  });

  it("rejects client price mismatch", async () => {
    const { initializePayment } = await import("@/features/payments/server/initializePayment");
    const bookingId = [...backend.bookings.keys()][0]!;
    const result = await initializePayment(user, {
      bookingId,
      lockId: "lock-1",
      priceCents: 99_000,
      paymentIdempotencyKey: "paystack:checkout:test",
      email: "c@test.com",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("QUOTE_MISMATCH");
  });

  it("uses locked server amount for paystack and leaves booking pending_payment only", async () => {
    const { initializePayment } = await import("@/features/payments/server/initializePayment");
    const bookingId = [...backend.bookings.keys()][0]!;

    const result = await initializePayment(user, {
      bookingId,
      lockId: "lock-1",
      paymentIdempotencyKey: "paystack:checkout:test",
      email: "c@test.com",
    });

    expect(result.ok).toBe(true);
    expect(hoisted.paystackInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 59_000,
        callback_url: "http://localhost:3000/payment/success",
      }),
    );
    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_payment");
    expect(booking?.status).not.toBe("confirmed");
    expect(hoisted.markConsumedMock).toHaveBeenCalledWith(expect.anything(), "lock-1");
  });

  it("reuses pending_payment on duplicate payment idempotency without extra bookings", async () => {
    const { initializePayment } = await import("@/features/payments/server/initializePayment");
    const bookingId = [...backend.bookings.keys()][0]!;
    const paymentKey = "paystack:checkout:dup-key";

    const first = await initializePayment(user, {
      bookingId,
      lockId: "lock-1",
      paymentIdempotencyKey: paymentKey,
      email: "c@test.com",
    });

    const second = await initializePayment(user, {
      bookingId,
      lockId: "lock-1",
      paymentIdempotencyKey: paymentKey,
      email: "c@test.com",
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(backend.bookings.size).toBe(1);
    const payments = await backend.listPaymentsForBooking(bookingId);
    expect(payments).toHaveLength(1);
    expect(hoisted.paystackInitMock).toHaveBeenCalledTimes(2);
  });

  it("forwards explicit callbackUrl to Paystack initialize", async () => {
    const { initializePayment } = await import("@/features/payments/server/initializePayment");
    const bookingId = [...backend.bookings.keys()][0]!;

    const result = await initializePayment(user, {
      bookingId,
      lockId: "lock-1",
      paymentIdempotencyKey: "paystack:checkout:test",
      email: "c@test.com",
      callbackUrl: "https://app.example.com/payment/success",
    });

    expect(result.ok).toBe(true);
    expect(hoisted.paystackInitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        callback_url: "https://app.example.com/payment/success",
      }),
    );
  });
});
