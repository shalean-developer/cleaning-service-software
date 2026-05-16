import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { InMemoryLockStore } from "./inMemoryLockStore";
import type { BookingLockInput } from "./types";
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

const user: CurrentUser = {
  profileId: "profile-1",
  role: "customer",
  authUser: { id: "profile-1", email: "c@test.com" } as CurrentUser["authUser"],
};

function baseInput(overrides: Partial<BookingLockInput> = {}): BookingLockInput {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const end = new Date(future.getTime() + 3 * 60 * 60 * 1000);
  return {
    checkoutIdempotencyKey: "checkout:test-1",
    clientQuoteTotalCents: 53_000,
    pricingInput: {
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    },
    scheduledStart: future.toISOString(),
    scheduledEnd: end.toISOString(),
    areaSlug: "cape-town",
    cleanerPreference: { mode: "best_available", selectedCleanerId: null },
    bookingMetadata: { quote: { input: {} } },
    ...overrides,
  };
}

describe("createBookingPaymentLock", () => {
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

  it("returns PROVISIONING_INCOMPLETE when customer row is missing", async () => {
    const { resolveActorScope } = await import("@/lib/auth/resolveActorScope");
    vi.mocked(resolveActorScope).mockResolvedValueOnce({});

    const { createBookingPaymentLock } = await import("./createBookingPaymentLock");
    const result = await createBookingPaymentLock(user, baseInput());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PROVISIONING_INCOMPLETE");
    expect(result.status).toBe(403);
  });

  it("rejects client quote mismatch", async () => {
    const { createBookingPaymentLock } = await import("./createBookingPaymentLock");
    const result = await createBookingPaymentLock(
      user,
      baseInput({ clientQuoteTotalCents: 1 }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("QUOTE_MISMATCH");
  });

  it("creates one draft booking and lock with server quote", async () => {
    const { createBookingPaymentLock } = await import("./createBookingPaymentLock");
    const result = await createBookingPaymentLock(user, baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.lockedPriceCents).toBe(53_000);
    expect(backend.bookings.size).toBe(1);
    const booking = [...backend.bookings.values()][0]!;
    expect(booking.price_cents).toBe(53_000);
    expect(booking.status).toBe("draft");
    expect(lockStore.locks.size).toBe(1);
  });

  it("reuses lock on repeated idempotency key", async () => {
    const { createBookingPaymentLock } = await import("./createBookingPaymentLock");
    const input = baseInput();
    const first = await createBookingPaymentLock(user, input);
    const second = await createBookingPaymentLock(user, input);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.idempotent).toBe(true);
    expect(second.bookingId).toBe(first.bookingId);
    expect(backend.bookings.size).toBe(1);
  });

  it("rejects ineligible selected cleaner", async () => {
    validateCleanerMock.mockResolvedValueOnce({
      ok: false,
      message: "Selected cleaner is suspended.",
    });
    const { createBookingPaymentLock } = await import("./createBookingPaymentLock");
    const result = await createBookingPaymentLock(
      user,
      baseInput({
        cleanerPreference: { mode: "selected", selectedCleanerId: "cleaner-x" },
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CLEANER_INELIGIBLE");
  });

  it("rejects expired lock on same key", async () => {
    const { createBookingPaymentLock } = await import("./createBookingPaymentLock");
    const input = baseInput({ checkoutIdempotencyKey: "checkout:expired" });
    const first = await createBookingPaymentLock(user, input);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const lock = await lockStore.findById(first.lockId);
    if (!lock) throw new Error("no lock");
    lockStore.locks.set(first.lockId, {
      ...lock,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
      status: "active",
    });

    const second = await createBookingPaymentLock(user, input);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("LOCK_EXPIRED");
  });
});
