import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { testAssignmentOfferRow } from "@/features/bookings/server/commands/testAssignmentOfferRow";
import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import {
  PRIMARY_COMPLETION_LINE_TYPE,
  SUPPORT_COMPLETION_LINE_TYPE,
} from "./teamEarningsSplit";
import { recordEarningsForBooking } from "./recordEarningsForBooking";
import { recordSupportTeamEarningsForBooking } from "./recordSupportTeamEarnings";
import { reconcileTeamEarningsForBooking } from "./teamEarningsReconciliation";
import { trueUpTeamEarningsForBooking } from "./teamEarningsTrueUp";
import type { BookingCleanerRow, BookingRow } from "@/lib/database/types";

const systemActor = { actorType: "system" as const, profileId: null };
const cleanerActor = { actorType: "cleaner" as const, profileId: "profile-cleaner-a" };
const adminActor = { actorType: "admin" as const, profileId: "admin-1" };
const customerId = "customer-1";
const cleanerA = "cleaner-a";
const cleanerB = "cleaner-b";
const cleanerCtxA = { actingCleanerId: cleanerA };

function supportRosterRow(bookingId: string, status: BookingCleanerRow["status"]): BookingCleanerRow {
  const ts = "2026-05-26T10:00:00.000Z";
  return {
    id: "roster-support",
    booking_id: bookingId,
    cleaner_id: cleanerB,
    role: "support",
    status,
    assigned_by_profile_id: null,
    support_completed_at: status === "completed" ? ts : null,
    support_note: null,
    created_at: ts,
    updated_at: ts,
  };
}

async function paidTeamBookingCompleted(
  backend: InMemoryBookingCommandBackend,
  options?: { supportStatus?: BookingCleanerRow["status"]; primaryOverpay?: boolean },
): Promise<string> {
  const quote = calculateQuote({
    serviceSlug: "regular-cleaning",
    bedrooms: 2,
    bathrooms: 1,
    teamSize: 2,
  });
  if (!quote.ok) throw new Error("quote failed");

  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: systemActor,
      customerId,
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
      priceCents: 73_000,
      metadata: buildBookingQuoteMetadata(
        { serviceSlug: "regular-cleaning", bedrooms: 2, bathrooms: 1, teamSize: 2 },
        quote.breakdown,
      ),
    },
    { actingCustomerId: customerId },
  );
  if (!draft.ok) throw new Error("draft failed");
  const bookingId = draft.bookingId;

  await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: systemActor,
      bookingId,
      paymentIdempotencyKey: `pay-${bookingId}`,
    },
    { actingCustomerId: customerId },
  );

  const payment = [...backend.payments.values()][0]!;
  await executeBookingCommand(
    backend,
    {
      type: "FINALIZE_PAYMENT_SUCCESS",
      actor: systemActor,
      bookingId,
      paymentId: payment.id,
      idempotencyKey: `fin-${bookingId}`,
    },
    {},
  );

  await executeBookingCommand(
    backend,
    { type: "MOVE_TO_PENDING_ASSIGNMENT", actor: systemActor, bookingId },
    {},
  );

  const offerId = crypto.randomUUID();
  const ts = new Date().toISOString();
  await backend.insertOffer(
    testAssignmentOfferRow({
      id: offerId,
      booking_id: bookingId,
      cleaner_id: cleanerA,
      status: "offered",
      offered_at: ts,
      responded_at: null,
      expires_at: null,
      created_at: ts,
      updated_at: ts,
    }),
  );

  await executeBookingCommand(
    backend,
    {
      type: "ACCEPT_CLEANER_ASSIGNMENT",
      actor: { actorType: "cleaner", profileId: "p" },
      bookingId,
      offerId,
    },
    { actingCleanerId: cleanerA },
  );

  await backend.upsertBookingCleanerRoster({
    bookingId,
    cleanerId: cleanerB,
    role: "support",
    status: options?.supportStatus ?? "accepted",
  });

  await executeBookingCommand(
    backend,
    {
      type: "MARK_BOOKING_IN_PROGRESS",
      actor: cleanerActor,
      bookingId,
    },
    { actingCleanerId: cleanerA },
  );

  await executeBookingCommand(
    backend,
    {
      type: "MARK_BOOKING_COMPLETED",
      actor: cleanerActor,
      bookingId,
    },
    { actingCleanerId: cleanerA },
  );

  if (options?.primaryOverpay) {
    const lines = await backend.listEarningLinesForBooking(bookingId);
    const primary = lines.find((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE)!;
    await backend.updateEarningLinePayoutAmount(bookingId, primary.id, primary.payout_amount_cents + 5_000);
  }

  return bookingId;
}

describe("NF-7H team earnings true-up and payout readiness", () => {
  beforeEach(() => {
    vi.stubEnv("TEAM_EARNINGS_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("adjusts primary line to equal split share", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingCompleted(backend, {
      supportStatus: "completed",
      primaryOverpay: true,
    });
    const booking = (await backend.getBooking(bookingId))!;
    const roster = await backend.listBookingCleanersForBooking(bookingId);

    const trueUp = await trueUpTeamEarningsForBooking(backend, booking);
    expect(trueUp.ok).toBe(true);
    if (!trueUp.ok) return;
    expect(trueUp.adjustedPrimary).toBe(true);

    const lines = await backend.listEarningLinesForBooking(bookingId);
    const primary = lines.find((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE)!;
    const support = lines.find((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE)!;
    expect(primary.payout_amount_cents).toBe(support.payout_amount_cents);

    const report = reconcileTeamEarningsForBooking({ booking, roster, earningLines: lines });
    expect(report.status).toBe("ok");
    expect(report.canMarkPayoutReady).toBe(true);
  });

  it("creates support line after support confirmation via true-up", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingCompleted(backend, { supportStatus: "accepted" });
    const booking = (await backend.getBooking(bookingId))!;
    booking.status = "completed";

    await backend.updateBookingCleanerRosterStatus(
      (await backend.listBookingCleanersForBooking(bookingId)).find((r) => r.role === "support")!
        .id,
      "completed",
    );

    const roster = await backend.listBookingCleanersForBooking(bookingId);
    const trueUp = await trueUpTeamEarningsForBooking(backend, booking);
    expect(trueUp.ok).toBe(true);
    if (!trueUp.ok) return;
    expect(trueUp.createdSupportLineIds.length).toBe(1);

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.filter((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE)).toHaveLength(1);
    const report = reconcileTeamEarningsForBooking({ booking, roster, earningLines: lines });
    expect(report.blockingIssues.some((i) => i.code === "MISSING_SUPPORT_EARNING_LINE")).toBe(
      false,
    );
  });

  it("blocks payout-ready when reconciliation fails", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingCompleted(backend, { supportStatus: "completed" });
    const lines = await backend.listEarningLinesForBooking(bookingId);
    const support = lines.find((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE)!;
    await backend.updateEarningLinePayoutAmount(
      bookingId,
      support.id,
      support.payout_amount_cents + 10_000,
    );

    const ready = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_PAYOUT_READY",
        actor: adminActor,
        bookingId,
      },
      {},
    );
    expect(ready.ok).toBe(false);
    if (ready.ok) return;
    expect(ready.code).toBe("EARNINGS_RECONCILIATION_BLOCKED");
  });

  it("allows payout-ready when reconciled after true-up", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingCompleted(backend, { supportStatus: "completed" });

    const ready = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_PAYOUT_READY",
        actor: adminActor,
        bookingId,
      },
      {},
    );
    expect(ready.ok).toBe(true);

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.every((l) => l.payout_status === "payout_ready")).toBe(true);
  });

  it("true-up is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingCompleted(backend, { supportStatus: "completed" });
    const booking = (await backend.getBooking(bookingId))!;

    const first = await trueUpTeamEarningsForBooking(backend, booking);
    const second = await trueUpTeamEarningsForBooking(backend, booking);
    expect(first.ok && second.ok).toBe(true);

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.filter((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE)).toHaveLength(1);
    expect(lines.filter((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE)).toHaveLength(1);
  });

  it("flag-off legacy payout-ready unchanged", async () => {
    vi.stubEnv("TEAM_EARNINGS_ENABLED", "false");
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingCompleted(backend, { supportStatus: "completed" });

    const ready = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_PAYOUT_READY",
        actor: adminActor,
        bookingId,
      },
      {},
    );
    expect(ready.ok).toBe(true);
    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.filter((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE)).toHaveLength(0);
  });

  it("recordEarningsForBooking does not change payment or assignment commands", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingCompleted(backend);
    const paymentsBefore = (await backend.listPaymentsForBooking(bookingId)).length;
    const offersBefore = (await backend.listOffersForBooking(bookingId)).length;

    const booking = (await backend.getBooking(bookingId))! as BookingRow;
    await recordEarningsForBooking(backend, booking);
    await recordSupportTeamEarningsForBooking(backend, booking, cleanerB);

    expect((await backend.listPaymentsForBooking(bookingId)).length).toBe(paymentsBefore);
    expect((await backend.listOffersForBooking(bookingId)).length).toBe(offersBefore);
    expect(booking.status).toBe("completed");
  });
});
