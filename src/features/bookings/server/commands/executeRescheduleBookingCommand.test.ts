import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { executeBookingCommand } from "./executeBookingCommand";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";

const adminActor = { actorType: "admin" as const, profileId: "admin-1" };
const mockClient = {} as SupabaseClient<Database>;

vi.mock("@/features/assignments/server/assignmentContext", () => ({
  loadAssignmentContext: vi.fn(async () => ({
    bookingId: "b1",
    scheduledStart: "",
    scheduledEnd: "",
    serviceSlug: "standard",
    areaSlug: "cape-town",
    scheduleTimezone: "Africa/Johannesburg",
  })),
}));

vi.mock("@/features/assignments/server/eligibilityForAssignment", () => ({
  isCleanerEligibleForAssignment: vi.fn(),
}));

import { isCleanerEligibleForAssignment } from "@/features/assignments/server/eligibilityForAssignment";

const systemActor = { actorType: "system" as const, profileId: null };

function futureIso(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3600_000).toISOString();
}

async function seedAssignedBooking(backend: InMemoryBookingCommandBackend): Promise<string> {
  const custId = crypto.randomUUID();
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: adminActor,
      customerId: custId,
      scheduledStart: futureIso(48),
      scheduledEnd: futureIso(51),
      priceCents: 8000,
    },
    {},
  );
  if (!draft.ok) throw new Error("draft");
  const bookingId = draft.bookingId;
  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: adminActor,
      bookingId,
      paymentIdempotencyKey: `pay-${custId}`,
    },
    {},
  );
  const paymentId = [...backend.payments.values()][0]!.id;
  await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId,
      paymentId,
      idempotencyKey: `fin-${custId}`,
    },
    {},
  );
  await executeBookingCommand(
    backend,
    { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
    {},
  );
  const cleanerId = crypto.randomUUID();
  const offerId = crypto.randomUUID();
  await backend.insertOffer({
    id: offerId,
    booking_id: bookingId,
    cleaner_id: cleanerId,
    status: "offered",
    team_role: "primary",
    expires_at: futureIso(72),
    responded_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  await executeBookingCommand(
    backend,
    {
      type: "ACCEPT_CLEANER_ASSIGNMENT",
      actor: { actorType: "cleaner", profileId: "cleaner-profile" },
      bookingId,
      offerId,
      cleanerId,
    },
    { actingCleanerId: cleanerId },
  );
  return bookingId;
}

describe("RESCHEDULE_BOOKING command", () => {
  beforeEach(() => {
    vi.mocked(isCleanerEligibleForAssignment).mockReset();
  });

  it("requires admin and confirm idempotency key", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const noKey = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(72),
        newScheduledEnd: futureIso(75),
        assignmentHandling: "block_if_unavailable",
      },
      { supabaseClient: mockClient },
    );
    expect(noKey.ok).toBe(false);
    if (noKey.ok) return;
    expect(noKey.code).toBe("IDEMPOTENCY_REQUIRED");
  });

  it("reschedules one-off pending_assignment booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const b = await backend.getBooking(bookingId);
    if (!b) throw new Error("missing");
    b.cleaner_id = null;
    b.status = "pending_assignment";
    backend.bookings.set(bookingId, b);
    const newStart = futureIso(96);
    const newEnd = futureIso(99);
    const result = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: newStart,
        newScheduledEnd: newEnd,
        assignmentHandling: "block_if_unavailable",
        idempotencyKey: "reschedule-1",
        supportRequestId: "req-1",
      },
      { supabaseClient: mockClient },
    );
    expect(result.ok).toBe(true);
    const updated = await backend.getBooking(bookingId);
    expect(updated?.scheduled_start).toBe(newStart);
    expect(updated?.scheduled_end).toBe(newEnd);
    expect(backend.audits.some((a) => a.idempotency_key === "reschedule-1")).toBe(true);
  });

  it("blocks completed and cancelled bookings", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const b = await backend.getBooking(bookingId);
    if (!b) throw new Error("missing");
    b.status = "completed";
    backend.bookings.set(bookingId, b);
    const completed = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(100),
        newScheduledEnd: futureIso(103),
        assignmentHandling: "block_if_unavailable",
        idempotencyKey: "reschedule-completed",
      },
      { supabaseClient: mockClient },
    );
    expect(completed.ok).toBe(false);
    b.status = "cancelled";
    backend.bookings.set(bookingId, b);
    const cancelled = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(100),
        newScheduledEnd: futureIso(103),
        assignmentHandling: "block_if_unavailable",
        idempotencyKey: "reschedule-cancelled",
      },
      { supabaseClient: mockClient },
    );
    expect(cancelled.ok).toBe(false);
  });

  it("blocks recurring series visits", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const b = await backend.getBooking(bookingId);
    if (!b) throw new Error("missing");
    b.series_id = crypto.randomUUID();
    backend.bookings.set(bookingId, b);
    const result = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(100),
        newScheduledEnd: futureIso(103),
        assignmentHandling: "block_if_unavailable",
        idempotencyKey: "reschedule-series",
      },
      { supabaseClient: mockClient },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RECURRING_NOT_SUPPORTED");
  });

  it("retains cleaner when available", async () => {
    vi.mocked(isCleanerEligibleForAssignment).mockResolvedValue(true);
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const before = await backend.getBooking(bookingId);
    const result = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(120),
        newScheduledEnd: futureIso(123),
        assignmentHandling: "keep_if_available",
        idempotencyKey: "reschedule-keep",
      },
      { supabaseClient: mockClient },
    );
    expect(result.ok).toBe(true);
    const after = await backend.getBooking(bookingId);
    expect(after?.cleaner_id).toBe(before?.cleaner_id);
    expect(after?.status).toBe("assigned");
  });

  it("unassigns when unavailable and policy allows", async () => {
    vi.mocked(isCleanerEligibleForAssignment).mockResolvedValue(false);
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const result = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(120),
        newScheduledEnd: futureIso(123),
        assignmentHandling: "unassign_if_unavailable",
        idempotencyKey: "reschedule-unassign",
      },
      { supabaseClient: mockClient },
    );
    expect(result.ok).toBe(true);
    const after = await backend.getBooking(bookingId);
    expect(after?.cleaner_id).toBeNull();
    expect(after?.status).toBe("pending_assignment");
  });

  it("blocks when unavailable and policy is block", async () => {
    vi.mocked(isCleanerEligibleForAssignment).mockResolvedValue(false);
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const result = await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(120),
        newScheduledEnd: futureIso(123),
        assignmentHandling: "block_if_unavailable",
        idempotencyKey: "reschedule-block",
      },
      { supabaseClient: mockClient },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("ASSIGNMENT_UNAVAILABLE");
  });

  it("cancels open offers on reschedule", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const custId = crypto.randomUUID();
    const draft = await executeBookingCommand(
      backend,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: adminActor,
        customerId: custId,
        scheduledStart: futureIso(48),
        scheduledEnd: futureIso(51),
        priceCents: 5000,
      },
      {},
    );
    if (!draft.ok) throw new Error("draft");
    const bookingId = draft.bookingId;
    await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: adminActor,
        bookingId,
        paymentIdempotencyKey: `pay-${custId}`,
      },
      {},
    );
    await executeBookingCommand(
      backend,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId: [...backend.payments.values()][0]!.id,
        idempotencyKey: `fin-${custId}`,
      },
      {},
    );
    await executeBookingCommand(
      backend,
      { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
      {},
    );
    const openOfferId = crypto.randomUUID();
    await backend.insertOffer({
      id: openOfferId,
      booking_id: bookingId,
      cleaner_id: crypto.randomUUID(),
      status: "offered",
      team_role: "primary",
      expires_at: futureIso(80),
      responded_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    vi.mocked(isCleanerEligibleForAssignment).mockResolvedValue(true);
    await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(130),
        newScheduledEnd: futureIso(133),
        assignmentHandling: "keep_if_available",
        idempotencyKey: "reschedule-offers",
      },
      { supabaseClient: mockClient },
    );
    const offers = await backend.listOffersForBooking(bookingId);
    expect(offers.filter((o) => o.status === "offered")).toHaveLength(0);
  });

  it("is idempotent by idempotency key", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    vi.mocked(isCleanerEligibleForAssignment).mockResolvedValue(true);
    const cmd = {
      type: "RESCHEDULE_BOOKING" as const,
      actor: adminActor,
      bookingId,
      newScheduledStart: futureIso(140),
      newScheduledEnd: futureIso(143),
      assignmentHandling: "keep_if_available" as const,
      idempotencyKey: "reschedule-idem",
    };
    const first = await executeBookingCommand(backend, cmd, { supabaseClient: mockClient });
    const second = await executeBookingCommand(backend, cmd, { supabaseClient: mockClient });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(backend.audits.filter((a) => a.idempotency_key === "reschedule-idem")).toHaveLength(1);
  });

  it("does not change payment status", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await seedAssignedBooking(backend);
    const paymentBefore = [...backend.payments.values()][0]!;
    vi.mocked(isCleanerEligibleForAssignment).mockResolvedValue(true);
    await executeBookingCommand(
      backend,
      {
        type: "RESCHEDULE_BOOKING",
        actor: adminActor,
        bookingId,
        newScheduledStart: futureIso(150),
        newScheduledEnd: futureIso(153),
        assignmentHandling: "keep_if_available",
        idempotencyKey: "reschedule-pay",
      },
      { supabaseClient: mockClient },
    );
    const paymentAfter = await backend.getPayment(paymentBefore.id);
    expect(paymentAfter?.status).toBe("paid");
    expect([...backend.payments.values()]).toHaveLength(1);
  });
});
