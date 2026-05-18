import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssignmentOfferRow,
  BookingCleanerRole,
  BookingCleanerRow,
  BookingCleanerStatus,
  BookingRow,
  BookingStateAuditRow,
  Database,
  EarningLineRow,
  Json,
  PaymentRow,
} from "@/lib/database/types";
import type { CleanerLifecycleSnapshot } from "@/features/cleaners/server/lifecycle/operationalState";
import type { BookingStatus } from "../types";
import type { BookingCommandBackend, TransitionResult } from "./bookingCommandBackend";
import { buildAuditEnvelope } from "./bookingCommandAudit";
import {
  parseRpcTransitionResult,
  rethrowRpcError,
  rpcAuditArgs,
} from "./bookingCommandRpc";
import type { BookingCommand } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Postgres-backed booking command port. Status changes use `booking_*` RPCs;
 * drafts, offers, payments, outbox, and earnings use service-role DML in the same
 * orchestration order as {@link executeBookingCommand}.
 */
export class SupabaseBookingCommandBackend implements BookingCommandBackend {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getBooking(bookingId: string): Promise<BookingRow | null> {
    const { data, error } = await this.client
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async getPayment(paymentId: string): Promise<PaymentRow | null> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async getOffer(offerId: string): Promise<AssignmentOfferRow | null> {
    const { data, error } = await this.client
      .from("assignment_offers")
      .select("*")
      .eq("id", offerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async findPaymentByIdempotencyKey(key: string): Promise<PaymentRow | null> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("idempotency_key", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async listPaymentsForBooking(bookingId: string): Promise<PaymentRow[]> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async listOffersForBooking(bookingId: string): Promise<AssignmentOfferRow[]> {
    const { data, error } = await this.client
      .from("assignment_offers")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async findAuditsByBookingAndKey(
    bookingId: string,
    key: string | null | undefined,
  ): Promise<BookingStateAuditRow[]> {
    if (!key) return [];
    const { data, error } = await this.client
      .from("booking_state_audit")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("idempotency_key", key);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async hasPaidPaymentForBooking(bookingId: string): Promise<boolean> {
    const { count, error } = await this.client
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("status", "paid");
    if (error) throw new Error(error.message);
    return (count ?? 0) > 0;
  }

  async getCleanerLifecycleSnapshot(
    cleanerId: string,
  ): Promise<CleanerLifecycleSnapshot | null> {
    const { data, error } = await this.client
      .from("cleaners")
      .select("active, suspended_at, deleted_at, onboarding_completed_at")
      .eq("id", cleanerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      active: data.active,
      suspendedAt: data.suspended_at,
      deletedAt: data.deleted_at,
      onboardingCompletedAt: data.onboarding_completed_at,
    };
  }

  async insertBooking(row: BookingRow): Promise<void> {
    const { error } = await this.client.from("bookings").insert(row);
    if (error) throw new Error(error.message);
  }

  async updateBookingMetadata(bookingId: string, metadata: Json): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ metadata, updated_at: nowIso() })
      .eq("id", bookingId);
    if (error) throw new Error(error.message);
  }

  async updateAssignmentDispatchAt(
    bookingId: string,
    assignmentDispatchAt: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from("bookings")
      .update({ assignment_dispatch_at: assignmentDispatchAt, updated_at: nowIso() })
      .eq("id", bookingId);
    if (error) throw new Error(error.message);
  }

  async insertPayment(payment: PaymentRow): Promise<void> {
    const { error } = await this.client.from("payments").insert(payment);
    if (error) throw new Error(error.message);
  }

  async insertOffer(offer: AssignmentOfferRow): Promise<void> {
    const { error } = await this.client.from("assignment_offers").insert(offer);
    if (error) throw new Error(error.message);
  }

  async updateOffer(offer: AssignmentOfferRow): Promise<void> {
    const { id, ...patch } = offer;
    const { error } = await this.client.from("assignment_offers").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async appendAudit(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus | null,
    to: BookingStatus,
  ): Promise<void> {
    const env = buildAuditEnvelope(cmd, from, to);
    const { error } = await this.client.from("booking_state_audit").insert({
      booking_id: bookingId,
      from_status: from,
      to_status: to,
      command: env.commandName,
      actor_profile_id: cmd.actor.profileId,
      payload: env.payload,
      actor_type: cmd.actor.actorType,
      reason: cmd.reason ?? null,
      idempotency_key: cmd.idempotencyKey ?? null,
      metadata: env.metadata,
    });
    if (error) throw new Error(error.message);
  }

  async applyTransition(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    cleanerId?: string | null,
  ): Promise<TransitionResult> {
    const audit = rpcAuditArgs(cmd, from, to);
    const { data, error } = await this.client.rpc("booking_apply_transition", {
      p_booking_id: bookingId,
      p_expected_from: from,
      p_to: to,
      p_cleaner_id: cleanerId ?? null,
      ...audit,
    });
    if (error) rethrowRpcError(error);
    return parseRpcTransitionResult(data);
  }

  async finalizePaymentSuccess(
    cmd: BookingCommand & { type: "FINALIZE_PAYMENT_SUCCESS" },
    bookingId: string,
    paymentId: string,
  ): Promise<TransitionResult> {
    const audit = rpcAuditArgs(cmd, "pending_payment", "confirmed");
    const { data, error } = await this.client.rpc("booking_finalize_payment_success", {
      p_booking_id: bookingId,
      p_payment_id: paymentId,
      ...audit,
    });
    if (error) rethrowRpcError(error);
    return parseRpcTransitionResult(data);
  }

  async recordPaymentFailure(
    cmd: BookingCommand & { type: "MARK_PAYMENT_FAILED" },
    bookingId: string,
    paymentId: string,
  ): Promise<TransitionResult> {
    const audit = rpcAuditArgs(cmd, "pending_payment", "payment_failed");
    const { data, error } = await this.client.rpc("booking_record_payment_failure", {
      p_booking_id: bookingId,
      p_payment_id: paymentId,
      ...audit,
    });
    if (error) rethrowRpcError(error);
    return parseRpcTransitionResult(data);
  }

  async expireAssignmentOffer(
    cmd: BookingCommand & { type: "EXPIRE_ASSIGNMENT_OFFER" },
    bookingId: string,
    offerId: string,
  ): Promise<TransitionResult> {
    const booking = await this.getBooking(bookingId);
    if (!booking) throw new Error("BOOKING_NOT_FOUND");

    const offer = await this.getOffer(offerId);
    if (!offer || offer.booking_id !== booking.id) {
      throw new Error("OFFER_NOT_FOUND");
    }
    if (offer.status !== "offered") {
      throw new Error("OFFER_NOT_OPEN");
    }

    const auditCmd: BookingCommand = {
      ...cmd,
      metadata: {
        offerId,
        cleanerId: cmd.cleanerId,
        expiredAt: cmd.expiredAt,
        expirySource: "cron",
        previousOfferStatus: "offered",
        ...(cmd.metadata && typeof cmd.metadata === "object" ? cmd.metadata : {}),
      },
    };

    const { data: updated, error: updateError } = await this.client
      .from("assignment_offers")
      .update({ status: "expired", updated_at: cmd.expiredAt })
      .eq("id", offerId)
      .eq("status", "offered")
      .select("id");

    if (updateError) throw new Error(updateError.message);
    if (!updated?.length) {
      throw new Error("OFFER_NOT_OPEN");
    }

    try {
      await this.appendAudit(auditCmd, booking.id, booking.status, booking.status);
    } catch (err) {
      const { error: rollbackError } = await this.client
        .from("assignment_offers")
        .update({ status: "offered", updated_at: offer.updated_at })
        .eq("id", offerId)
        .eq("status", "expired");
      if (rollbackError) throw new Error(rollbackError.message);
      throw err;
    }

    return { status: booking.status, idempotent: false };
  }

  async adminOverrideStatus(
    cmd: BookingCommand & { type: "ADMIN_OVERRIDE_STATUS" },
    booking: BookingRow,
  ): Promise<BookingStatus> {
    const from = booking.status;
    if (from === cmd.nextStatus) {
      return cmd.nextStatus;
    }
    const r = await this.applyTransition(cmd, booking.id, from, cmd.nextStatus);
    return r.status;
  }

  async enqueueNotification(channel: string, recipient: string, payload: Json): Promise<void> {
    const ts = nowIso();
    const { error } = await this.client.from("notification_outbox").insert({
      channel,
      recipient,
      payload,
      status: "pending",
      attempts: 0,
      next_retry_at: null,
      last_error: null,
      created_at: ts,
      updated_at: ts,
    });
    if (error) throw new Error(error.message);
  }

  async appendEarningLine(line: Omit<EarningLineRow, "id" | "created_at">): Promise<void> {
    const payoutAmount = line.payout_amount_cents ?? line.amount_cents;
    const { error } = await this.client.from("earning_lines").insert({
      ...line,
      amount_cents: line.amount_cents ?? payoutAmount,
      gross_amount_cents: line.gross_amount_cents ?? payoutAmount,
      payout_amount_cents: payoutAmount,
      payout_status: line.payout_status ?? "pending",
      payout_batch_id: line.payout_batch_id ?? null,
      calculation_metadata: line.calculation_metadata ?? {},
    });
    if (error) throw new Error(error.message);
  }

  async listEarningLinesForBooking(bookingId: string): Promise<EarningLineRow[]> {
    const { data, error } = await this.client
      .from("earning_lines")
      .select("*")
      .eq("booking_id", bookingId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async updateEarningLinePayoutAmount(
    bookingId: string,
    lineId: string,
    payoutAmountCents: number,
    teamMetadata?: {
      team_earning_role?: EarningLineRow["team_earning_role"];
      team_earning_source?: EarningLineRow["team_earning_source"];
    },
  ): Promise<boolean> {
    const { data: existing, error: fetchError } = await this.client
      .from("earning_lines")
      .select("id, payout_status, calculation_metadata")
      .eq("booking_id", bookingId)
      .eq("id", lineId)
      .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);
    if (!existing || existing.payout_status !== "pending") return false;

    const priorMeta =
      existing.calculation_metadata && typeof existing.calculation_metadata === "object"
        ? (existing.calculation_metadata as Record<string, unknown>)
        : {};

    const { data, error } = await this.client
      .from("earning_lines")
      .update({
        amount_cents: payoutAmountCents,
        payout_amount_cents: payoutAmountCents,
        team_earning_role: teamMetadata?.team_earning_role,
        team_earning_source: teamMetadata?.team_earning_source,
        calculation_metadata: {
          ...priorMeta,
          trueUpAdjustedAt: new Date().toISOString(),
          trueUpExpectedShareCents: payoutAmountCents,
        },
      })
      .eq("booking_id", bookingId)
      .eq("id", lineId)
      .eq("payout_status", "pending")
      .select("id");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  async updateEarningLinesPayoutStatus(
    bookingId: string,
    from: EarningLineRow["payout_status"],
    to: EarningLineRow["payout_status"],
    payoutBatchId?: string | null,
  ): Promise<number> {
    const patch: Partial<EarningLineRow> = { payout_status: to };
    if (payoutBatchId) patch.payout_batch_id = payoutBatchId;
    const { data, error } = await this.client
      .from("earning_lines")
      .update(patch)
      .eq("booking_id", bookingId)
      .eq("payout_status", from)
      .select("id");
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  }

  async listBookingCleanersForBooking(bookingId: string): Promise<BookingCleanerRow[]> {
    const { data, error } = await this.client
      .from("booking_cleaners")
      .select("*")
      .eq("booking_id", bookingId);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async upsertBookingCleanerRoster(params: {
    bookingId: string;
    cleanerId: string;
    role: BookingCleanerRole;
    status: BookingCleanerStatus;
    assignedByProfileId?: string | null;
  }): Promise<BookingCleanerRow> {
    const ts = nowIso();
    const { data: existing, error: findError } = await this.client
      .from("booking_cleaners")
      .select("*")
      .eq("booking_id", params.bookingId)
      .eq("cleaner_id", params.cleanerId)
      .maybeSingle();
    if (findError) throw new Error(findError.message);

    if (existing) {
      const { data, error } = await this.client
        .from("booking_cleaners")
        .update({
          role: params.role,
          status: params.status,
          assigned_by_profile_id:
            params.assignedByProfileId ?? existing.assigned_by_profile_id,
          updated_at: ts,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { data, error } = await this.client
      .from("booking_cleaners")
      .insert({
        booking_id: params.bookingId,
        cleaner_id: params.cleanerId,
        role: params.role,
        status: params.status,
        assigned_by_profile_id: params.assignedByProfileId ?? null,
        support_completed_at: null,
        support_note: null,
        created_at: ts,
        updated_at: ts,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateBookingCleanerRosterStatus(
    rosterId: string,
    status: BookingCleanerStatus,
  ): Promise<void> {
    const { error } = await this.client
      .from("booking_cleaners")
      .update({ status, updated_at: nowIso() })
      .eq("id", rosterId);
    if (error) throw new Error(error.message);
  }
}
