import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { readAssignmentMetadata } from "./assignmentMetadata";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "./constants";
import { findAssignmentRecoveryCandidates } from "./findAssignmentRecoveryCandidates";
import {
  DISPATCH_NOT_STARTED_REASON,
  isAssignmentRecoveryCandidate,
} from "./isAssignmentRecoveryCandidate";
import { runAssignmentRecoveryBatch } from "./runAssignmentRecovery";
import { buildOfferExpiresAt } from "./buildOfferExpiry";
import { createDispatchOffer } from "./createDispatchOffer";

const eligibilityMock = vi.hoisted(() => ({
  isCleanerEligibleForAssignment: vi.fn(),
  pickBestEligibleCleanerId: vi.fn(),
}));

vi.mock("./eligibilityForAssignment", () => eligibilityMock);

vi.mock("./assignmentContext", () => ({
  loadAssignmentContext: vi.fn(),
}));

const systemActor = { actorType: "system" as const, profileId: null };
const customerId = "customer-recovery";

function createRecoveryClient(
  backend: InMemoryBookingCommandBackend,
): SupabaseClient<import("@/lib/database/types").Database> {
  return {
    from(table: string) {
      if (table === "payments") {
        const paymentChain = (col: string, val: string) => ({
          lte: (lteCol: string, lteVal: string) => ({
            order: () => ({
              limit: async () => {
                const rows = [...backend.payments.values()].filter((p) => {
                  if (col === "status" && p.status !== val) return false;
                  if (lteCol === "updated_at") {
                    const updated = p.updated_at || p.created_at;
                    if (updated > lteVal) return false;
                  }
                  return true;
                });
                return { data: rows, error: null };
              },
            }),
          }),
          maybeSingle: async () => {
            const row = [...backend.payments.values()].find((p) =>
              col === "id" ? p.id === val : false,
            );
            return { data: row ?? null, error: null };
          },
        });
        return {
          select: () => ({
            eq: (col: string, val: string) => paymentChain(col, val),
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
              order: async () => {
                const rows = [...backend.offers.values()].filter((o) =>
                  col === "booking_id" ? o.booking_id === val : true,
                );
                return { data: rows, error: null };
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

  const paid = backend.payments.get(payment.id)!;
  paid.updated_at = paidAt;
  backend.payments.set(paid.id, paid);

  return draft.bookingId;
}

describe("isAssignmentRecoveryCandidate", () => {
  const now = new Date("2026-05-18T12:00:00.000Z");
  const paidAt = "2026-05-18T11:00:00.000Z";

  it("detects confirmed paid booking with no offers past grace", () => {
    expect(
      isAssignmentRecoveryCandidate({
        booking: { status: "confirmed", cleaner_id: null },
        payments: [{ status: "paid", updated_at: paidAt, created_at: paidAt }],
        offers: [],
        now,
        graceMinutes: ASSIGNMENT_RECOVERY_GRACE_MINUTES,
      }),
    ).toBe(true);
  });

  it("skips when still inside grace window", () => {
    expect(
      isAssignmentRecoveryCandidate({
        booking: { status: "confirmed", cleaner_id: null },
        payments: [
          {
            status: "paid",
            updated_at: "2026-05-18T11:59:00.000Z",
            created_at: "2026-05-18T11:59:00.000Z",
          },
        ],
        offers: [],
        now,
        graceMinutes: ASSIGNMENT_RECOVERY_GRACE_MINUTES,
      }),
    ).toBe(false);
  });

  it("skips when open offer exists", () => {
    expect(
      isAssignmentRecoveryCandidate({
        booking: { status: "confirmed", cleaner_id: null },
        payments: [{ status: "paid", updated_at: paidAt, created_at: paidAt }],
        offers: [
          {
            status: "offered",
            expires_at: buildOfferExpiresAt(new Date("2026-05-19T12:00:00.000Z")),
          },
        ],
        now,
        graceMinutes: ASSIGNMENT_RECOVERY_GRACE_MINUTES,
      }),
    ).toBe(false);
  });

  it("skips when cleaner already assigned on booking", () => {
    expect(
      isAssignmentRecoveryCandidate({
        booking: { status: "confirmed", cleaner_id: "cleaner-1" },
        payments: [{ status: "paid", updated_at: paidAt, created_at: paidAt }],
        offers: [],
        now,
        graceMinutes: ASSIGNMENT_RECOVERY_GRACE_MINUTES,
      }),
    ).toBe(false);
  });
});

describe("runAssignmentRecoveryBatch", () => {
  beforeEach(() => {
    eligibilityMock.isCleanerEligibleForAssignment.mockReset();
    eligibilityMock.pickBestEligibleCleanerId.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("recovers stuck confirmed booking via runAssignmentAfterPayment", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = "2026-05-18T10:00:00.000Z";
    const now = new Date("2026-05-18T12:00:00.000Z");
    const bookingId = await seedConfirmedPaidBooking(backend, paidAt);

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

    const client = createRecoveryClient(backend);
    const result = await runAssignmentRecoveryBatch(client, backend, { now });

    expect(result.candidateCount).toBeGreaterThanOrEqual(1);
    expect(result.recoveredBookingIds).toContain(bookingId);

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("pending_assignment");
    expect([...backend.offers.values()]).toHaveLength(1);
  });

  it("does not duplicate offers when recovery runs twice", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = "2026-05-18T10:00:00.000Z";
    const now = new Date("2026-05-18T12:00:00.000Z");
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

    const client = createRecoveryClient(backend);
    const first = await runAssignmentRecoveryBatch(client, backend, { now });
    const second = await runAssignmentRecoveryBatch(client, backend, { now });

    expect(first.candidateCount).toBe(0);
    expect(second.candidateCount).toBe(0);
    expect(first.attemptedCount).toBe(0);
    expect([...backend.offers.values()].filter((o) => o.status === "offered")).toHaveLength(1);
  });

  it("findAssignmentRecoveryCandidates returns stuck booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const paidAt = "2026-05-18T10:00:00.000Z";
    const now = new Date("2026-05-18T12:00:00.000Z");
    const bookingId = await seedConfirmedPaidBooking(backend, paidAt);

    const client = createRecoveryClient(backend);
    const candidates = await findAssignmentRecoveryCandidates(client, { now });
    expect(candidates.some((c) => c.bookingId === bookingId)).toBe(true);
  });
});

describe("dispatch not started metadata", () => {
  it("uses shared reason string", () => {
    expect(DISPATCH_NOT_STARTED_REASON).toContain("dispatch not started");
  });

  it("records attention metadata on dispatch failure helper", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedConfirmedPaidBooking(
      backend,
      "2026-05-18T10:00:00.000Z",
    );

    const { recordPostPaymentAssignmentDispatchFailure } = await import(
      "./postPaymentAssignmentObservability"
    );
    await recordPostPaymentAssignmentDispatchFailure(backend, bookingId);

    const booking = await backend.getBooking(bookingId);
    const meta = readAssignmentMetadata(booking?.metadata);
    expect(meta?.status).toBe("attention_required");
    expect(meta?.reason).toBe(DISPATCH_NOT_STARTED_REASON);
  });
});
