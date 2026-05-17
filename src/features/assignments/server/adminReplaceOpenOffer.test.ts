import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { buildOfferExpiresAt } from "./buildOfferExpiry";
import { createDispatchOffer } from "./createDispatchOffer";
import { showAdminReplaceOpenOfferPanel } from "@/components/dashboard/AdminReplaceOpenOfferAction";
import { showAdminManualDispatchPanel } from "@/components/dashboard/AdminManualDispatchAction";
import {
  runAdminReplaceOpenOffer,
  validateAdminReplaceReason,
} from "./adminReplaceOpenOffer";
import { ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING } from "./constants";

const eligibilityMock = vi.hoisted(() => ({
  isCleanerEligibleForAssignment: vi.fn(),
}));

vi.mock("./eligibilityForAssignment", () => eligibilityMock);

vi.mock("./assignmentContext", () => ({
  loadAssignmentContext: vi.fn(),
}));

const serviceRoleMock = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
}));

const backendMock = vi.hoisted(() => ({
  createBookingCommandBackend: vi.fn(),
}));

vi.mock("@/lib/supabase/serviceRole", () => serviceRoleMock);
vi.mock("@/features/bookings/server/commands/runBookingCommand", () => backendMock);

vi.mock("@/features/admin/server/adminOperationalAuditSidecar", () => ({
  auditAdminReplaceOpenOffer: vi.fn().mockResolvedValue(undefined),
}));

const systemActor = { actorType: "system" as const, profileId: null };
const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};
const cleanerUser: CurrentUser = {
  profileId: "profile-cleaner",
  role: "cleaner",
  authUser: { id: "auth-cleaner" } as CurrentUser["authUser"],
};
const customerId = "customer-replace-offer";

function createReplaceClient(
  backend: InMemoryBookingCommandBackend,
): SupabaseClient<import("@/lib/database/types").Database> {
  return {
    from(table: string) {
      if (table === "payments") {
        return {
          select: () => ({
            eq: (_col: string, val: string) =>
              Promise.resolve({
                data: [...backend.payments.values()].filter((p) => p.booking_id === val),
                error: null,
              }),
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => {
                const booking = [...backend.bookings.values()].find((b) => b.id === val);
                return { data: booking ?? null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "assignment_offers") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: () => {
                const rows = [...backend.offers.values()].filter((o) => o.booking_id === val);
                return Promise.resolve({ data: rows, error: null });
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<import("@/lib/database/types").Database>;
}

async function seedPendingAssignmentBooking(
  backend: InMemoryBookingCommandBackend,
): Promise<string> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
      priceCents: 40_000,
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

const mockContext = {
  bookingId: "booking-x",
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

describe("validateAdminReplaceReason", () => {
  it("requires min length", () => {
    expect(validateAdminReplaceReason("short").ok).toBe(false);
    expect(validateAdminReplaceReason("valid reason here").ok).toBe(true);
  });
});

describe("showAdminReplaceOpenOfferPanel", () => {
  it("shows replace panel when eligible", () => {
    expect(showAdminReplaceOpenOfferPanel({ replaceOfferEligible: true })).toBe(true);
    expect(showAdminReplaceOpenOfferPanel({ replaceOfferEligible: false })).toBe(false);
    expect(
      showAdminManualDispatchPanel("pending_assignment", { manualDispatchEligible: false }),
    ).toBe(false);
  });
});

describe("runAdminReplaceOpenOffer", () => {
  beforeEach(() => {
    eligibilityMock.isCleanerEligibleForAssignment.mockReset();
    eligibilityMock.isCleanerEligibleForAssignment.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin", async () => {
    const result = await runAdminReplaceOpenOffer(cleanerUser, "b1", {
      targetCleanerId: "cleaner-b",
      reason: "support ticket 12345",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });

  it("replaces open offer without assigning cleaner", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });

    serviceRoleMock.createServiceRoleClient.mockReturnValue(createReplaceClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });

    const result = await runAdminReplaceOpenOffer(adminUser, bookingId, {
      targetCleanerId: "cleaner-b",
      reason: "Cleaner A not responding; offering B",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("replaced");
      expect(result.targetCleanerId).toBe("cleaner-b");
    }

    const booking = await backend.getBooking(bookingId);
    expect(booking?.cleaner_id).toBeNull();
    expect(booking?.status).toBe("pending_assignment");

    const offers = await backend.listOffersForBooking(bookingId);
    expect(offers.find((o) => o.cleaner_id === "cleaner-a")?.status).toBe("cancelled");
    expect(offers.find((o) => o.cleaner_id === "cleaner-b")?.status).toBe("offered");
  });

  it("rejects same cleaner as open offer", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });

    serviceRoleMock.createServiceRoleClient.mockReturnValue(createReplaceClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminReplaceOpenOffer(adminUser, bookingId, {
      targetCleanerId: "cleaner-a",
      reason: "Same cleaner selected again",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SAME_CLEANER");
  });

  it("rejects when no open offer", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createReplaceClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminReplaceOpenOffer(adminUser, bookingId, {
      targetCleanerId: "cleaner-b",
      reason: "No open offer on this booking",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_OPEN_OFFER");
  });

  it("rejects ineligible target cleaner", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createReplaceClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });
    eligibilityMock.isCleanerEligibleForAssignment.mockResolvedValue(false);

    const result = await runAdminReplaceOpenOffer(adminUser, bookingId, {
      targetCleanerId: "cleaner-b",
      reason: "Target not eligible for slot",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLEANER_NOT_ELIGIBLE");
  });

  it("requires max attempts acknowledgement", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });
    const now = new Date().toISOString();
    for (let i = 0; i < ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING - 1; i++) {
      backend.offers.set(`offer-prior-${i}`, {
        id: `offer-prior-${i}`,
        booking_id: bookingId,
        cleaner_id: `cleaner-prior-${i}`,
        status: "declined",
        offered_at: now,
        responded_at: now,
        expires_at: null,
        created_at: now,
        updated_at: now,
      });
    }

    serviceRoleMock.createServiceRoleClient.mockReturnValue(createReplaceClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });

    const withoutAck = await runAdminReplaceOpenOffer(adminUser, bookingId, {
      targetCleanerId: "cleaner-b",
      reason: "Max attempts without checkbox",
    });
    expect(withoutAck.ok).toBe(false);
    if (!withoutAck.ok) expect(withoutAck.code).toBe("MAX_ATTEMPTS_REACHED");

    const withAck = await runAdminReplaceOpenOffer(adminUser, bookingId, {
      targetCleanerId: "cleaner-b",
      reason: "Max attempts with acknowledgement",
      acknowledgeMaxAttempts: true,
    });
    expect(withAck.ok).toBe(true);
    if (withAck.ok) expect(withAck.status).toBe("replaced");
  });
});
