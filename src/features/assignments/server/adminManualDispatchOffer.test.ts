import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { testAssignmentOfferRow } from "@/features/bookings/server/commands/testAssignmentOfferRow";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { buildOfferExpiresAt } from "./buildOfferExpiry";
import { createDispatchOffer } from "./createDispatchOffer";
import { showAdminManualDispatchPanel } from "@/components/dashboard/AdminManualDispatchAction";
import {
  runAdminManualDispatchOffer,
  validateAdminDispatchReason,
} from "./adminManualDispatchOffer";
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

const auditSidecarMock = vi.hoisted(() => ({
  auditAdminManualDispatch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/admin/server/adminOperationalAuditSidecar", () => auditSidecarMock);

const systemActor = { actorType: "system" as const, profileId: null };
const customerId = "customer-manual-dispatch";

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

function createDispatchClient(
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

describe("validateAdminDispatchReason", () => {
  it("requires min length", () => {
    expect(validateAdminDispatchReason("short").ok).toBe(false);
    expect(validateAdminDispatchReason("valid reason here").ok).toBe(true);
  });
});

describe("showAdminManualDispatchPanel", () => {
  it("shows when pending_assignment and manualDispatchEligible", () => {
    expect(
      showAdminManualDispatchPanel("pending_assignment", { manualDispatchEligible: true }),
    ).toBe(true);
    expect(
      showAdminManualDispatchPanel("confirmed", { manualDispatchEligible: true }),
    ).toBe(false);
    expect(
      showAdminManualDispatchPanel("pending_assignment", { manualDispatchEligible: false }),
    ).toBe(false);
  });
});

describe("runAdminManualDispatchOffer", () => {
  beforeEach(() => {
    eligibilityMock.isCleanerEligibleForAssignment.mockReset();
    eligibilityMock.isCleanerEligibleForAssignment.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin", async () => {
    const result = await runAdminManualDispatchOffer(cleanerUser, "b1", {
      cleanerId: "cleaner-a",
      reason: "support ticket 12345",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });

  it("requires reason", async () => {
    const backend = new InMemoryBookingCommandBackend();
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createDispatchClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminManualDispatchOffer(adminUser, "missing", {
      cleanerId: "cleaner-a",
      reason: "tiny",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_PAYLOAD");
  });

  it("creates offer for pending_assignment with eligible cleaner", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    const client = createDispatchClient(backend);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(client);
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });

    const result = await runAdminManualDispatchOffer(adminUser, bookingId, {
      cleanerId: "cleaner-a",
      reason: "Selected cleaner declined; offering backup",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("offered");
      expect(result.bookingStatus).toBe("pending_assignment");
    }
    const booking = await backend.getBooking(bookingId);
    expect(booking?.cleaner_id).toBeNull();
    expect(booking?.status).toBe("pending_assignment");
    const offers = await backend.listOffersForBooking(bookingId);
    expect(offers.some((o) => o.cleaner_id === "cleaner-a" && o.status === "offered")).toBe(
      true,
    );
    expect(auditSidecarMock.auditAdminManualDispatch).toHaveBeenCalled();
  });

  it("rejects confirmed booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
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
    if (!draft.ok) throw new Error("draft");
    const bookingId = draft.bookingId;
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createDispatchClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminManualDispatchOffer(adminUser, bookingId, {
      cleanerId: "cleaner-a",
      reason: "Should not work on confirmed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_ELIGIBLE");
  });

  it("rejects when open offer to different cleaner", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createDispatchClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });

    const result = await runAdminManualDispatchOffer(adminUser, bookingId, {
      cleanerId: "cleaner-b",
      reason: "Trying another cleaner while offer open",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("OPEN_OFFER_EXISTS");
  });

  it("returns idempotent success for same cleaner open offer", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createDispatchClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });

    const result = await runAdminManualDispatchOffer(adminUser, bookingId, {
      cleanerId: "cleaner-a",
      reason: "Re-offer same cleaner idempotent path",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("already_offered");
      expect(result.idempotent).toBe(true);
    }
  });

  it("rejects ineligible cleaner", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createDispatchClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });
    eligibilityMock.isCleanerEligibleForAssignment.mockResolvedValue(false);

    const result = await runAdminManualDispatchOffer(adminUser, bookingId, {
      cleanerId: "cleaner-a",
      reason: "Cleaner not eligible for this slot",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CLEANER_NOT_ELIGIBLE");
  });

  it("requires max attempts acknowledgement", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedPendingAssignmentBooking(backend);
    const now = new Date().toISOString();
    for (let i = 0; i < ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING; i++) {
      backend.offers.set(
        `offer-${i}`,
        testAssignmentOfferRow({
          id: `offer-${i}`,
          booking_id: bookingId,
          cleaner_id: `cleaner-${i}`,
          status: "declined",
          offered_at: now,
          responded_at: now,
          expires_at: null,
          created_at: now,
          updated_at: now,
        }),
      );
    }
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createDispatchClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({ ...mockContext, bookingId });

    const withoutAck = await runAdminManualDispatchOffer(adminUser, bookingId, {
      cleanerId: "cleaner-new",
      reason: "Max attempts without checkbox",
    });
    expect(withoutAck.ok).toBe(false);
    if (!withoutAck.ok) expect(withoutAck.code).toBe("MAX_ATTEMPTS_REACHED");

    const withAck = await runAdminManualDispatchOffer(adminUser, bookingId, {
      cleanerId: "cleaner-new",
      reason: "Max attempts with acknowledgement",
      acknowledgeMaxAttempts: true,
    });
    expect(withAck.ok).toBe(true);
    if (withAck.ok) expect(withAck.status).toBe("offered");
  });
});
