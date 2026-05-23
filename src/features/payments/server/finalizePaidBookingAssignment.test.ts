import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { Database, PaymentRow } from "@/lib/database/types";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import { DISPATCH_NOT_STARTED_REASON } from "@/features/assignments/server/isAssignmentRecoveryCandidate";
import { handlePostPaymentAssignmentFailure } from "@/features/assignments/server/postPaymentAssignmentObservability";
import { finalizePaidBookingWithDeps } from "./finalizePaidBooking";
import type { PaystackChargeSuccess } from "./paystackTypes";

const dispatchMock = vi.hoisted(() => ({
  runPostPaymentAssignmentDispatch: vi.fn(),
}));

vi.mock("./postPaymentAssignmentDispatch", () => ({
  runPostPaymentAssignmentDispatch: dispatchMock.runPostPaymentAssignmentDispatch,
}));

vi.mock("@/features/zoho-sales-sync/server/runPostPaymentZohoSalesSync", () => ({
  runPostPaymentZohoSalesSync: vi.fn(),
}));

const systemActor = { actorType: "system" as const, profileId: null };

function createPaymentStoreMock(initial: PaymentRow) {
  const paymentsById = new Map<string, PaymentRow>([[initial.id, initial]]);
  const eventIds = new Set<string>();

  const client = {
    from(table: string) {
      if (table === "payments") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data: paymentsById.get(value) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "payment_events") {
        return {
          insert: async (row: { provider_event_id: string }) => {
            if (eventIds.has(row.provider_event_id)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            eventIds.add(row.provider_event_id);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };

  return { client: client as unknown as SupabaseClient<Database> };
}

async function seedPending(
  backend: InMemoryBookingCommandBackend,
  customerId: string,
): Promise<{ bookingId: string; payment: PaymentRow }> {
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
      priceCents: 25_000,
    },
    {},
  );
  if (!draft.ok) throw new Error("draft");

  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: systemActor,
      bookingId: draft.bookingId,
      paymentIdempotencyKey: "pay-key",
    },
    {},
  );

  const payment = [...backend.payments.values()][0]!;
  return { bookingId: draft.bookingId, payment };
}

const charge: PaystackChargeSuccess = {
  reference: "ref-assignment-fail",
  transactionId: 1,
  amountCents: 25_000,
  providerEventId: "evt-assignment-fail",
  metadata: {},
};

describe("finalizePaidBooking assignment observability", () => {
  beforeEach(() => {
    dispatchMock.runPostPaymentAssignmentDispatch.mockReset();
    dispatchMock.runPostPaymentAssignmentDispatch.mockResolvedValue({
      action: "skipped_immediate",
      assignmentDispatchAt: new Date().toISOString(),
      assignmentResult: {
        ok: true,
        bookingId: "x",
        bookingStatus: "pending_assignment",
        outcome: "offered",
        offerId: null,
        cleanerId: null,
        idempotent: false,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps payment successful when assignment throws", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, payment } = await seedPending(backend, "cust-fail");
    const { client } = createPaymentStoreMock(payment);

    dispatchMock.runPostPaymentAssignmentDispatch.mockImplementation(
      async (_client, backend, _booking, input) => {
        await handlePostPaymentAssignmentFailure(backend, {
          bookingId: input.bookingId,
          paymentId: input.paymentId,
          customerId: input.customerId,
          assignmentCode: "ASSIGNMENT_EXCEPTION",
          assignmentMessage: "dispatch blew up",
          bookingStatusAfter: "confirmed",
          thrown: true,
        });
        throw new Error("dispatch blew up");
      },
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge,
      source: "webhook",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe("confirmed");

    const booking = await backend.getBooking(bookingId);
    expect(booking?.status).toBe("confirmed");
    const meta = readAssignmentMetadata(booking?.metadata);
    expect(meta?.reason).toBe(DISPATCH_NOT_STARTED_REASON);

    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes("post_payment_assignment_failed"))).toBe(
      true,
    );

    warnSpy.mockRestore();
  });

  it("records dispatch attention when assignment returns failure", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const { bookingId, payment } = await seedPending(backend, "cust-fail-2");
    const { client } = createPaymentStoreMock(payment);

    dispatchMock.runPostPaymentAssignmentDispatch.mockImplementation(
      async (_client, backend, _booking, input) => {
        await handlePostPaymentAssignmentFailure(backend, {
          bookingId: input.bookingId,
          paymentId: input.paymentId,
          customerId: input.customerId,
          assignmentCode: "ASSIGNMENT_CONTEXT_MISSING",
          assignmentMessage: "Could not load booking assignment context.",
          bookingStatusAfter: "confirmed",
          thrown: false,
        });
      },
    );

    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await finalizePaidBookingWithDeps(client, backend, {
      bookingId,
      paymentId: payment.id,
      charge: { ...charge, providerEventId: "evt-assignment-fail-2", reference: "ref-2" },
      source: "webhook",
    });

    expect(result.ok).toBe(true);
    const booking = await backend.getBooking(bookingId);
    expect(readAssignmentMetadata(booking?.metadata)?.reason).toBe(DISPATCH_NOT_STARTED_REASON);
  });
});
