import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { testAssignmentOfferRow } from "@/features/bookings/server/commands/testAssignmentOfferRow";
import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import {
  PRIMARY_COMPLETION_LINE_TYPE,
  SUPPORT_COMPLETION_LINE_TYPE,
  computeEqualShareCents,
  computePrimaryCompletionSplit,
} from "./teamEarningsSplit";
import { recordEarningsForBooking } from "./recordEarningsForBooking";
import { recordSupportTeamEarningsForBooking } from "./recordSupportTeamEarnings";
import { reconcileTeamEarningsForBooking } from "./teamEarningsReconciliation";
import type { BookingCleanerRow, BookingRow } from "@/lib/database/types";

const systemActor = { actorType: "system" as const, profileId: null };
const cleanerActor = { actorType: "cleaner" as const, profileId: "profile-cleaner-a" };
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

async function paidTeamBookingInProgress(
  backend: InMemoryBookingCommandBackend,
  options?: { supportStatus?: BookingCleanerRow["status"] },
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
    {
      type: "MOVE_TO_PENDING_ASSIGNMENT",
      actor: systemActor,
      bookingId,
    },
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

  return bookingId;
}

describe("NF-7G team earnings foundation", () => {
  beforeEach(() => {
    vi.stubEnv("TEAM_EARNINGS_ENABLED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("equal split policy divides pool between lead and accepted support", () => {
    const roster = [supportRosterRow("b1", "accepted")];
    const split = computePrimaryCompletionSplit(60_000, roster, true);
    expect(split.payoutAmountCents).toBe(30_000);
    expect(split.teamEarningSource).toBe("team_split");
    expect(computeEqualShareCents(60_000, 2)).toBe(30_000);
  });

  it("creates primary and support lines after completion and confirmation", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingInProgress(backend, { supportStatus: "completed" });

    const complete = await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
        idempotencyKey: `complete-${bookingId}`,
      },
      cleanerCtxA,
    );
    expect(complete.ok).toBe(true);

    const lines = await backend.listEarningLinesForBooking(bookingId);
    const primary = lines.filter((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE);
    const support = lines.filter((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE);
    expect(primary).toHaveLength(1);
    expect(support).toHaveLength(1);
    expect(primary[0]!.cleaner_id).toBe(cleanerA);
    expect(support[0]!.cleaner_id).toBe(cleanerB);
    expect(primary[0]!.payout_amount_cents).toBe(support[0]!.payout_amount_cents);
    expect(primary[0]!.team_earning_source).toBe("team_split");
  });

  it("does not create support line without participation confirmation", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingInProgress(backend, { supportStatus: "accepted" });
    const booking = (await backend.getBooking(bookingId))!;

    await recordEarningsForBooking(backend, booking);
    const supportResult = await recordSupportTeamEarningsForBooking(
      backend,
      { ...booking, status: "completed" },
      cleanerB,
    );
    expect(supportResult.ok).toBe(false);
    if (!supportResult.ok) {
      expect(supportResult.code).toBe("INVALID_STATE");
    }

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.filter((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE)).toHaveLength(0);
  });

  it("single-cleaner booking unchanged when team earnings enabled", async () => {
    vi.stubEnv("TEAM_EARNINGS_ENABLED", "true");
    const backend = new InMemoryBookingCommandBackend();
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      teamSize: 1,
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
        priceCents: 53_000,
        metadata: buildBookingQuoteMetadata(
          { serviceSlug: "regular-cleaning", bedrooms: 2, bathrooms: 1, teamSize: 1 },
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
      {
        type: "MOVE_TO_PENDING_ASSIGNMENT",
        actor: systemActor,
        bookingId,
      },
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
      cleanerCtxA,
    );

    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.team_earning_source).toBe("legacy_primary");
  });

  it("feature flag off preserves legacy primary-only payout amount", async () => {
    vi.stubEnv("TEAM_EARNINGS_ENABLED", "false");
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingInProgress(backend, { supportStatus: "completed" });
    const booking = (await backend.getBooking(bookingId))!;
    booking.status = "completed";
    backend.bookings.set(bookingId, booking);

    await recordEarningsForBooking(backend, booking);
    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.filter((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE)).toHaveLength(1);
    expect(lines.filter((l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE)).toHaveLength(0);
    expect(lines[0]!.team_earning_source).toBeNull();
  });

  it("payout summary aggregates multiple lines per booking", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingInProgress(backend, { supportStatus: "completed" });
    await executeBookingCommand(
      backend,
      {
        type: "MARK_BOOKING_COMPLETED",
        actor: cleanerActor,
        bookingId,
      },
      cleanerCtxA,
    );
    const lines = await backend.listEarningLinesForBooking(bookingId);
    const total = lines.reduce((s, l) => s + l.payout_amount_cents, 0);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(total).toBeGreaterThan(lines[0]!.payout_amount_cents);
  });

  it("reconciliation flags missing support confirmation after lead completion", () => {
    const booking = {
      id: "b1",
      status: "completed",
      cleaner_id: cleanerA,
      price_cents: 73_000,
      metadata: {},
    } as BookingRow;
    const roster = [supportRosterRow("b1", "accepted")];
    const report = reconcileTeamEarningsForBooking({
      booking,
      roster,
      earningLines: [
        {
          id: "e1",
          cleaner_id: cleanerA,
          booking_id: "b1",
          amount_cents: 30_000,
          gross_amount_cents: 73_000,
          payout_amount_cents: 30_000,
          payout_status: "pending",
          payout_batch_id: null,
          line_type: PRIMARY_COMPLETION_LINE_TYPE,
          description: null,
          metadata: {},
          calculation_metadata: {},
          team_earning_role: "primary",
          team_earning_source: "team_split",
          created_at: "2026-05-26T10:00:00.000Z",
        },
      ],
    });
    expect(report.issues.some((i) => i.code === "MISSING_SUPPORT_CONFIRMATION")).toBe(true);
  });

  it("recordEarningsForBooking duplicate prevention is idempotent", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = await paidTeamBookingInProgress(backend);
    const booking = (await backend.getBooking(bookingId))!;
    booking.status = "completed";
    backend.bookings.set(bookingId, booking);

    const first = await recordEarningsForBooking(backend, booking);
    const second = await recordEarningsForBooking(backend, booking);
    expect(first.ok && second.ok).toBe(true);
    const lines = await backend.listEarningLinesForBooking(bookingId);
    expect(lines.filter((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE)).toHaveLength(1);
  });
});
