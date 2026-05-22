import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "./constants";
import { buildOfferExpiresAt } from "./buildOfferExpiry";
import { createDispatchOffer } from "./createDispatchOffer";
import { showAdminRecoverAssignmentAction } from "@/components/dashboard/AdminRecoverAssignmentAction";
import {
  logAdminAssignmentRecovery,
  runAdminSingleBookingAssignmentRecovery,
  validateAdminRecoveryReason,
} from "./adminAssignmentRecovery";

const eligibilityMock = vi.hoisted(() => ({
  isCleanerEligibleForAssignment: vi.fn(),
  pickBestEligibleCleanerId: vi.fn(),
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
  auditAdminAssignmentRecovery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/admin/server/adminOperationalAuditSidecar", () => auditSidecarMock);

const systemActor = { actorType: "system" as const, profileId: null };
const customerId = "customer-admin-recovery";

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

function createRecoveryClient(
  backend: InMemoryBookingCommandBackend,
): SupabaseClient<import("@/lib/database/types").Database> {
  return {
    from(table: string) {
      if (table === "payments") {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              const rows =
                col === "booking_id"
                  ? [...backend.payments.values()].filter((p) => p.booking_id === val)
                  : col === "id"
                    ? [...backend.payments.values()].filter((p) => p.id === val)
                    : [];
              const result = { data: rows, error: null };
              return Promise.resolve(result);
            },
          }),
        };
      }
      if (table === "bookings") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: async () => {
                if (col === "id") {
                  const booking = [...backend.bookings.values()].find((b) => b.id === val);
                  return { data: booking ?? null, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        };
      }
      if (table === "assignment_offers") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              order: () => {
                const rows = [...backend.offers.values()].filter((o) =>
                  col === "booking_id" ? o.booking_id === val : true,
                );
                return Promise.resolve({ data: rows, error: null });
              },
              maybeSingle: async () => {
                const row = [...backend.offers.values()].find((o) =>
                  col === "booking_id" ? o.booking_id === val : false,
                );
                return { data: row ?? null, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<import("@/lib/database/types").Database>;
}

async function seedConfirmedPaidBooking(
  backend: InMemoryBookingCommandBackend,
  paidAt: string,
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

  const paid = backend.payments.get(payment.id)!;
  paid.updated_at = paidAt;
  backend.payments.set(paid.id, paid);

  return draft.bookingId;
}

describe("validateAdminRecoveryReason", () => {
  it("requires min length after trim", () => {
    expect(validateAdminRecoveryReason("short").ok).toBe(false);
    expect(validateAdminRecoveryReason("valid reason here").ok).toBe(true);
  });
});

describe("showAdminRecoverAssignmentAction", () => {
  it("shows button only when eligible", () => {
    expect(showAdminRecoverAssignmentAction("eligible")).toBe(true);
    expect(showAdminRecoverAssignmentAction("grace_period")).toBe(false);
    expect(showAdminRecoverAssignmentAction("not_applicable")).toBe(false);
    expect(showAdminRecoverAssignmentAction("in_progress")).toBe(false);
  });
});

describe("runAdminSingleBookingAssignmentRecovery", () => {
  beforeEach(() => {
    eligibilityMock.isCleanerEligibleForAssignment.mockReset();
    eligibilityMock.pickBestEligibleCleanerId.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin", async () => {
    const result = await runAdminSingleBookingAssignmentRecovery(cleanerUser, "b1", {
      reason: "support ticket 12345",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FORBIDDEN");
  });

  it("requires reason", async () => {
    const backend = new InMemoryBookingCommandBackend();
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createRecoveryClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminSingleBookingAssignmentRecovery(adminUser, "missing", {
      reason: "tiny",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_PAYLOAD");
  });

  it("recovers eligible confirmed booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const bookingId = await seedConfirmedPaidBooking(backend, paidAt);
    const client = createRecoveryClient(backend);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(client);
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({
      bookingId,
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
    });
    eligibilityMock.pickBestEligibleCleanerId.mockResolvedValue("cleaner-a");

    const result = await runAdminSingleBookingAssignmentRecovery(adminUser, bookingId, {
      reason: "Paid but dispatch not started. admin recovery",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("recovered");
      expect(result.bookingStatus).toBe("pending_assignment");
    }
    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_assignment");
    expect(auditSidecarMock.auditAdminAssignmentRecovery).toHaveBeenCalled();
  });

  it("rejects inside grace period", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = new Date().toISOString();
    const bookingId = await seedConfirmedPaidBooking(backend, paidAt);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(createRecoveryClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminSingleBookingAssignmentRecovery(adminUser, bookingId, {
      reason: "Trying too soon after payment",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GRACE_PERIOD");
  });

  it("rejects when open offer exists", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const bookingId = await seedConfirmedPaidBooking(backend, paidAt);

    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
    await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });

    serviceRoleMock.createServiceRoleClient.mockReturnValue(createRecoveryClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminSingleBookingAssignmentRecovery(adminUser, bookingId, {
      reason: "Should not recover while offer is open",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_ELIGIBLE");
  });

  it("returns already_recovered for assigned booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const bookingId = await seedConfirmedPaidBooking(backend, paidAt);

    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
    const offer = await createDispatchOffer(backend, {
      bookingId,
      cleanerId: "cleaner-a",
      expiresAt: buildOfferExpiresAt(),
    });
    if (!offer.offerId) throw new Error("no offer");
    await executeBookingCommand(
      backend,
      {
        type: "ACCEPT_CLEANER_ASSIGNMENT",
        actor: { actorType: "cleaner", profileId: "cl-p" },
        bookingId,
        offerId: offer.offerId,
      },
      { actingCleanerId: "cleaner-a" },
    );

    serviceRoleMock.createServiceRoleClient.mockReturnValue(createRecoveryClient(backend));
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const result = await runAdminSingleBookingAssignmentRecovery(adminUser, bookingId, {
      reason: "No-op recovery on assigned booking",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.status).toBe("already_recovered");
  });

  it("does not duplicate offers on second eligible call after first recovery", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const bookingId = await seedConfirmedPaidBooking(backend, paidAt);
    const client = createRecoveryClient(backend);
    serviceRoleMock.createServiceRoleClient.mockReturnValue(client);
    backendMock.createBookingCommandBackend.mockReturnValue(backend);

    const { loadAssignmentContext } = await import("./assignmentContext");
    vi.mocked(loadAssignmentContext).mockResolvedValue({
      bookingId,
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
    });
    eligibilityMock.pickBestEligibleCleanerId.mockResolvedValue("cleaner-a");

    vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = await runAdminSingleBookingAssignmentRecovery(adminUser, bookingId, {
      reason: "First admin recovery attempt",
    });
    expect(first.ok).toBe(true);

    const second = await runAdminSingleBookingAssignmentRecovery(adminUser, bookingId, {
      reason: "Second admin recovery attempt",
    });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("NOT_ELIGIBLE");

    expect([...backend.offers.values()].filter((o) => o.status === "offered")).toHaveLength(1);
  });
});

describe("logAdminAssignmentRecovery", () => {
  it("logs structured JSON without secrets", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logAdminAssignmentRecovery({
      bookingId: "b1",
      adminProfileId: "admin-1",
      reason: "ops recovery",
      eligible: true,
      resultStatus: "recovered",
      bookingStatusAfter: "pending_assignment",
      engine: {
        ok: true,
        bookingId: "b1",
        bookingStatus: "pending_assignment",
        outcome: "offered",
        offerId: "o1",
        cleanerId: "c1",
        idempotent: false,
      },
    });
    expect(spy).toHaveBeenCalled();
    const payload = JSON.parse(String(spy.mock.calls[0]![0]));
    expect(payload.event).toBe("admin_assignment_recovery");
    expect(payload.reason).toBe("ops recovery");
    spy.mockRestore();
  });
});
