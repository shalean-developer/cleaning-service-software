import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { Database } from "@/lib/database/types";
import type { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";
import { adminCreatePendingPaymentBookingFacade } from "./adminCreatePendingPaymentBookingFacade";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";
import { adminGeneratePaymentLinkFacade } from "./adminGeneratePaymentLinkFacade";

const completePaystackBookingCheckoutMock = vi.fn();
const resolveCustomerEmailMock = vi.fn();
const updatePaymentLinkMetadataMock = vi.fn();

const hoisted = vi.hoisted(() => ({
  memoryBackend: null as InMemoryBookingCommandBackend | null,
  paymentLinksActive: true,
  assistState: {
    customers: new Set<string>(["11111111-1111-4111-8111-111111111111"]),
    idempotency: new Map<string, Record<string, unknown>>(),
    audits: [] as Record<string, unknown>[],
  },
}));

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

vi.mock("@/lib/app/adminAssistedPaymentLinksFlag", () => ({
  isAdminAssistedPaymentLinksActive: () => hoisted.paymentLinksActive,
}));

vi.mock("@/features/payments/server/paystackEnv", () => ({
  isPaystackEnabled: () => true,
}));

vi.mock("@/features/payments/server/completePaystackBookingCheckout", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/features/payments/server/completePaystackBookingCheckout")
  >();
  return {
    ...actual,
    completePaystackBookingCheckout: (...args: unknown[]) =>
      completePaystackBookingCheckoutMock(...args),
  };
});

vi.mock("@/features/notifications/server/resolveCustomerEmail", () => ({
  resolveCustomerEmail: (...args: unknown[]) => resolveCustomerEmailMock(...args),
}));

vi.mock("@/features/payments/server/paymentRepository", () => ({
  updatePaymentLinkMetadata: (...args: unknown[]) => updatePaymentLinkMetadataMock(...args),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => {
    if (!hoisted.memoryBackend) {
      throw new Error("memoryBackend not initialized");
    }
    return hoisted.memoryBackend;
  },
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => createAssistMockClient(hoisted.assistState),
}));

function createAssistMockClient(state: typeof hoisted.assistState): SupabaseClient<Database> {
  return {
    from: (table: string) => {
      if (table === "customers") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: state.customers.has(value) ? { id: value } : null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "admin_booking_assist_idempotency") {
        return {
          select: () => ({
            eq: (_column: string, key: string) => ({
              maybeSingle: async () => ({
                data: state.idempotency.has(key)
                  ? { result: state.idempotency.get(key) }
                  : null,
                error: null,
              }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            const key = row.idempotency_key as string;
            if (state.idempotency.has(key)) {
              return Promise.resolve({ error: { code: "23505", message: "duplicate" } });
            }
            state.idempotency.set(key, row.result as Record<string, unknown>);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "admin_booking_assist_audit") {
        return {
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                state.audits.push(row);
                return { data: { id: `audit-${state.audits.length}` }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient<Database>;
}

const adminUser: CurrentUser = {
  profileId: "admin-profile-1",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

const customerUser: CurrentUser = {
  profileId: "customer-profile",
  role: "customer",
  authUser: { id: "auth-customer" } as CurrentUser["authUser"],
};

function futureSchedule(): { scheduledStart: string; scheduledEnd: string } {
  const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  start.setUTCHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  return { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
}

function sampleDraftBody(): AdminCreateBookingDraftBody {
  const schedule = futureSchedule();
  return {
    customerId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: `admin-draft-${Math.random().toString(36).slice(2, 10)}`,
    scheduledStart: schedule.scheduledStart,
    scheduledEnd: schedule.scheduledEnd,
    pricingInput: {
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    },
    address: {
      addressLine1: "12 Main Rd",
      suburb: "Sea Point",
      city: "Cape Town",
    },
    cleanerPreferenceMode: "best_available",
  };
}

async function seedPendingPaymentBooking(): Promise<{
  bookingId: string;
  paymentId: string;
  priceCents: number;
}> {
  const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
  expect(draft.ok).toBe(true);
  if (!draft.ok) throw new Error("draft failed");

  const pending = await adminCreatePendingPaymentBookingFacade({
    admin: adminUser,
    bookingId: draft.bookingDraft.bookingId,
    body: {
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: `pending-${Math.random().toString(36).slice(2, 10)}`,
    },
  });
  expect(pending.ok).toBe(true);
  if (!pending.ok) throw new Error("pending failed");

  const payment = [...hoisted.memoryBackend!.payments.values()].find(
    (p) => p.booking_id === draft.bookingDraft.bookingId,
  );
  if (!payment) throw new Error("payment missing");

  return {
    bookingId: draft.bookingDraft.bookingId,
    paymentId: payment.id,
    priceCents: draft.bookingDraft.priceCents,
  };
}

describe("adminGeneratePaymentLinkFacade", () => {
  beforeEach(async () => {
    const { InMemoryBookingCommandBackend } = await import(
      "@/features/bookings/server/commands/inMemoryBookingCommandBackend"
    );
    hoisted.memoryBackend = new InMemoryBookingCommandBackend();
    hoisted.memoryBackend.bookings.clear();
    hoisted.memoryBackend.payments.clear();
    hoisted.memoryBackend.audits = [];
    hoisted.assistState.idempotency.clear();
    hoisted.assistState.audits = [];
    hoisted.paymentLinksActive = true;
    vi.stubEnv("BOOKING_COMMAND_BACKEND", "memory");

    resolveCustomerEmailMock.mockResolvedValue({
      ok: true,
      recipient: { email: "customer@example.com" },
    });
    updatePaymentLinkMetadataMock.mockResolvedValue(undefined);
    completePaystackBookingCheckoutMock.mockImplementation(
      async (input: { bookingId: string; payment: { id: string } }) => ({
        ok: true,
        bookingId: input.bookingId,
        paymentId: input.payment.id,
        status: "pending_payment",
        authorizationUrl: "https://checkout.paystack.com/admin-assisted",
        accessCode: "access-code",
        reference: `bk_${input.bookingId.replace(/-/g, "").slice(0, 8)}_payref`,
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("generates payment link for admin-assisted pending_payment booking", async () => {
    const { bookingId, priceCents } = await seedPendingPaymentBooking();
    const idempotencyKey = "plink-key-12345678";

    const result = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey,
        deliveryChannel: "copy_only",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentLink.paymentUrl).toContain("paystack");
    expect(result.paymentLink.reference).toMatch(/^bk_/);
    expect(result.paymentLink.bookingId).toBe(bookingId);

    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(booking?.status).toBe("pending_payment");
    expect(booking?.price_cents).toBe(priceCents);
    expect(
      hoisted.assistState.audits.some(
        (row) => row.action === "admin_booking_payment_link_generated",
      ),
    ).toBe(true);

    expect(completePaystackBookingCheckoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId,
        metadataSource: "admin_assisted",
        email: "customer@example.com",
      }),
    );
  });

  it("rejects non-admin", async () => {
    const { bookingId } = await seedPendingPaymentBooking();
    const result = await adminGeneratePaymentLinkFacade({
      admin: customerUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FORBIDDEN");
  });

  it("rejects when payment-link feature flag is off", async () => {
    hoisted.paymentLinksActive = false;
    const { bookingId } = await seedPendingPaymentBooking();
    const result = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FEATURE_DISABLED");
  });

  it("rejects draft booking", async () => {
    const draft = await adminCreateBookingDraftFacade({ admin: adminUser, body: sampleDraftBody() });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const result = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId: draft.bookingDraft.bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_STATUS");
  });

  it("rejects confirmed booking", async () => {
    const { bookingId } = await seedPendingPaymentBooking();
    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    if (booking) booking.status = "confirmed";

    const result = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_STATUS");
  });

  it("rejects wrong customer", async () => {
    const { bookingId } = await seedPendingPaymentBooking();
    const result = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "22222222-2222-4222-8222-222222222222",
        idempotencyKey: "plink-key-12345678",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("WRONG_CUSTOMER");
  });

  it("replays idempotency with same active link", async () => {
    const { bookingId } = await seedPendingPaymentBooking();
    const idempotencyKey = "plink-idem-12345678";
    const body = {
      customerId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey,
      deliveryChannel: "copy_only" as const,
    };

    const first = await adminGeneratePaymentLinkFacade({ admin: adminUser, bookingId, body });
    const second = await adminGeneratePaymentLinkFacade({ admin: adminUser, bookingId, body });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.paymentLink.idempotent).toBe(true);
    expect(second.paymentLink.paymentUrl).toBe(first.paymentLink.paymentUrl);
    expect(completePaystackBookingCheckoutMock).toHaveBeenCalledTimes(1);
  });

  it("regenerates with new reference and supersedes previous link", async () => {
    const { bookingId } = await seedPendingPaymentBooking();

    completePaystackBookingCheckoutMock
      .mockImplementationOnce(async (input: { bookingId: string; payment: { id: string } }) => ({
        ok: true,
        bookingId: input.bookingId,
        paymentId: input.payment.id,
        status: "pending_payment",
        authorizationUrl: "https://checkout.paystack.com/first",
        accessCode: "a1",
        reference: "bk_first_ref",
      }))
      .mockImplementationOnce(async (input: { bookingId: string; payment: { id: string } }) => ({
        ok: true,
        bookingId: input.bookingId,
        paymentId: input.payment.id,
        status: "pending_payment",
        authorizationUrl: "https://checkout.paystack.com/second",
        accessCode: "a2",
        reference: "bk_second_ref",
      }));

    const first = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-first-12345678",
        deliveryChannel: "copy_only",
      },
    });
    expect(first.ok).toBe(true);

    const second = await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-second-12345678",
        deliveryChannel: "copy_only",
        regenerate: true,
      },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.paymentLink.reference).toBe("bk_second_ref");

    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    const meta = booking?.metadata as Record<string, unknown>;
    const assist = meta?.adminAssist as Record<string, unknown>;
    const history = assist?.paymentLinkHistory as unknown[];
    expect(Array.isArray(history) && history.length).toBeGreaterThan(0);
    expect(
      hoisted.assistState.audits.some(
        (row) => row.action === "admin_booking_payment_link_regenerated",
      ),
    ).toBe(true);
    expect(hoisted.memoryBackend!.bookings.get(bookingId)?.status).toBe("pending_payment");
  });

  it("keeps booking pending_payment after link generation", async () => {
    const { bookingId } = await seedPendingPaymentBooking();
    await adminGeneratePaymentLinkFacade({
      admin: adminUser,
      bookingId,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "plink-pending-guard-123",
      },
    });
    const booking = hoisted.memoryBackend!.bookings.get(bookingId);
    expect(booking?.status).toBe("pending_payment");
    expect(booking?.status).not.toBe("confirmed");
  });
});

describe("adminGeneratePaymentLinkFacade safety (static)", () => {
  it("must not import payment finalize or assignment modules", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(process.cwd(), "src/features/bookings/server/admin/adminGeneratePaymentLinkFacade.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/\bfinalizePaidBooking\b/);
    expect(source).not.toMatch(/\binitializePayment\b/);
    expect(source).not.toMatch(/\brunPostPaymentAssignmentDispatch\b/);
    expect(source).not.toMatch(/\brunAssignmentAfterPayment\b/);
    expect(source).not.toMatch(/\bADMIN_RECORD_OFFLINE_PAYMENT\b/);
    expect(source).not.toMatch(/\bADMIN_CREATE_BOOKING\b/);
    expect(source).not.toMatch(/\bFINALIZE_PAYMENT_SUCCESS\b/);
    expect(source).toContain("completePaystackBookingCheckout");
  });

  it("payment-link route must not import finalize or assignment", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(
      join(
        process.cwd(),
        "src/app/api/admin/bookings/[bookingId]/payment-link/route.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/\bfinalizePaidBooking\b/);
    expect(source).not.toMatch(/\brunPostPaymentAssignmentDispatch\b/);
    expect(source).toContain("adminGeneratePaymentLinkFacade");
  });
});
