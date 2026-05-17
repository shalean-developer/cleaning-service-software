import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSIGNMENT_OFFER_TEMPLATE,
  canRunNotificationDelivery,
  getNotificationDeliveryConfig,
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_OUTBOX_BATCH_SIZE,
  NOTIFICATION_RETRY_BASE_MINUTES,
  buildDeliverableOutboxTemplateOrFilter,
  PAYMENT_CONFIRMED_TEMPLATE,
  PAYMENT_FAILED_TEMPLATE,
} from "./config";
import { hasSentAssignmentOfferForOffer } from "./hasSentAssignmentOfferForOffer";
import { hasSentPaymentConfirmedForBooking } from "./hasSentPaymentConfirmedForBooking";
import { hasSentPaymentFailedForBooking } from "./hasSentPaymentFailedForBooking";
import {
  isOfferPastExpiry,
  loadAssignmentOfferNotificationContext,
} from "./loadAssignmentOfferNotificationContext";
import { loadPaymentFailedNotificationContext } from "./loadPaymentFailedNotificationContext";
import { resolveCleanerEmail } from "./resolveCleanerEmail";
import { resolveCustomerEmail } from "./resolveCustomerEmail";
import { buildAssignmentOfferEmail } from "./templates/assignmentOffer";
import { buildPaymentConfirmedEmail } from "./templates/paymentConfirmed";
import { buildPaymentFailedEmail } from "./templates/paymentFailed";
import type { EmailSender, SendEmailResult } from "./sendEmail";
import { reclaimStaleProcessingNotifications } from "./reclaimStaleProcessingNotifications";
import { sendEmailViaResend } from "./sendEmail";
import type { Database, Json, NotificationOutboxRow } from "@/lib/database/types";

export type ProcessNotificationOutboxError = {
  outboxId: string;
  code: string;
  message: string;
};

export type ProcessNotificationOutboxResult = {
  ok: true;
  deliveryEnabled: boolean;
  /** Rows moved processing → pending because claim exceeded stale threshold. */
  reclaimed: number;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: ProcessNotificationOutboxError[];
};

function readTemplate(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const template = (payload as Record<string, unknown>).template;
  return typeof template === "string" ? template : null;
}

function readBookingId(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const bookingId = (payload as Record<string, unknown>).bookingId;
  return typeof bookingId === "string" && bookingId.trim() ? bookingId.trim() : null;
}

function readOfferId(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const offerId = (payload as Record<string, unknown>).offerId;
  return typeof offerId === "string" && offerId.trim() ? offerId.trim() : null;
}

/** Defense-in-depth gate aligned with {@link buildDeliverableOutboxTemplateOrFilter}. */
export function isDeliverableOutboxRow(row: NotificationOutboxRow): boolean {
  const template = readTemplate(row.payload);
  if (template === PAYMENT_CONFIRMED_TEMPLATE || template === PAYMENT_FAILED_TEMPLATE) {
    return row.channel === "email";
  }
  if (template === ASSIGNMENT_OFFER_TEMPLATE) {
    return (
      row.channel === "push" &&
      Boolean(readOfferId(row.payload) && readBookingId(row.payload))
    );
  }
  return false;
}

function computeNextRetryAt(attempts: number, now: Date): string {
  const multiplier = Math.min(2 ** Math.max(attempts - 1, 0), 32);
  const delayMs = NOTIFICATION_RETRY_BASE_MINUTES * 60_000 * multiplier;
  return new Date(now.getTime() + delayMs).toISOString();
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/\S+@\S+/g, "[redacted]").slice(0, 500);
}

async function claimOutboxRow(
  client: SupabaseClient<Database>,
  rowId: string,
  nowIso: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("notification_outbox")
    .update({ status: "processing", updated_at: nowIso })
    .eq("id", rowId)
    .eq("status", "pending")
    .select("id");

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

async function markOutboxSent(
  client: SupabaseClient<Database>,
  rowId: string,
  attempts: number,
  nowIso: string,
): Promise<void> {
  const { error } = await client
    .from("notification_outbox")
    .update({
      status: "sent",
      attempts: attempts + 1,
      next_retry_at: null,
      last_error: null,
      updated_at: nowIso,
    })
    .eq("id", rowId);

  if (error) throw new Error(error.message);
}

async function markOutboxFailure(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  errorMessage: string,
  retryable: boolean,
  now: Date,
): Promise<void> {
  const attempts = row.attempts + 1;
  const nowIso = now.toISOString();
  const exhausted = !retryable || attempts >= NOTIFICATION_MAX_ATTEMPTS;

  const { error } = await client
    .from("notification_outbox")
    .update({
      status: exhausted ? "failed" : "pending",
      attempts,
      next_retry_at: exhausted ? null : computeNextRetryAt(attempts, now),
      last_error: sanitizeErrorMessage(errorMessage),
      updated_at: nowIso,
    })
    .eq("id", row.id);

  if (error) throw new Error(error.message);
}

async function releaseOutboxClaim(
  client: SupabaseClient<Database>,
  rowId: string,
  nowIso: string,
): Promise<void> {
  await client
    .from("notification_outbox")
    .update({ status: "pending", updated_at: nowIso })
    .eq("id", rowId)
    .eq("status", "processing");
}

type RowProcessResult =
  | { outcome: "sent" }
  | { outcome: "skipped" }
  | { outcome: "failed"; code: string; message: string; retryable?: boolean };

async function processPaymentConfirmedRow(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  emailSender: EmailSender,
  now: Date,
): Promise<RowProcessResult> {
  const bookingId = readBookingId(row.payload);
  if (!bookingId) {
    return { outcome: "failed", code: "INVALID_PAYLOAD", message: "Missing bookingId in payload." };
  }

  if (await hasSentPaymentConfirmedForBooking(client, bookingId, row.id)) {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped" };
  }

  const resolved = await resolveCustomerEmail(client, row.recipient);
  if (!resolved.ok) {
    return {
      outcome: "failed",
      code: resolved.code,
      message:
        resolved.code === "NO_EMAIL"
          ? "Customer has no email address."
          : "Customer not found for recipient.",
    };
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, scheduled_start, scheduled_end, metadata")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return { outcome: "failed", code: "BOOKING_NOT_FOUND", message: "Booking not found." };
  }

  const config = getNotificationDeliveryConfig();
  const content = buildPaymentConfirmedEmail({
    booking,
    customerDisplayName: resolved.recipient.displayName,
    bookingDetailUrl: `${config.appBaseUrl}/customer/bookings/${booking.id}`,
    supportEmail: config.supportEmail,
  });

  const sendResult: SendEmailResult = await emailSender({
    to: resolved.recipient.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sendResult.ok) {
    await markOutboxFailure(client, row, sendResult.error, sendResult.retryable, now);
    return { outcome: "failed", code: "SEND_FAILED", message: sendResult.error };
  }

  await markOutboxSent(client, row.id, row.attempts, now.toISOString());
  return { outcome: "sent" };
}

async function processAssignmentOfferRow(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  emailSender: EmailSender,
  now: Date,
): Promise<RowProcessResult> {
  const bookingId = readBookingId(row.payload);
  const offerId = readOfferId(row.payload);
  if (!bookingId || !offerId) {
    return { outcome: "failed", code: "INVALID_PAYLOAD", message: "Missing bookingId or offerId." };
  }

  if (await hasSentAssignmentOfferForOffer(client, offerId, row.id)) {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped" };
  }

  const loaded = await loadAssignmentOfferNotificationContext(client, offerId, bookingId);
  if (!loaded.ok) {
    return {
      outcome: "failed",
      code: loaded.code,
      message:
        loaded.code === "BOOKING_NOT_FOUND" ? "Booking not found." : "Offer not found.",
    };
  }

  const { offer, serviceLabel, scheduleLabel, locationLabel, earningsLabel, expiresAtLabel } =
    loaded.context;

  if (offer.cleaner_id !== row.recipient) {
    return {
      outcome: "failed",
      code: "RECIPIENT_MISMATCH",
      message: "Offer recipient does not match outbox recipient.",
    };
  }

  if (offer.status !== "offered") {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped" };
  }

  if (isOfferPastExpiry(offer.expires_at, now)) {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped" };
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, status, cleaner_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return { outcome: "failed", code: "BOOKING_NOT_FOUND", message: "Booking not found." };
  }

  if (booking.status !== "pending_assignment") {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped" };
  }

  if (booking.cleaner_id != null) {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped" };
  }

  const resolved = await resolveCleanerEmail(client, row.recipient);
  if (!resolved.ok) {
    return {
      outcome: "failed",
      code: resolved.code,
      message:
        resolved.code === "NO_EMAIL"
          ? "Cleaner has no email address."
          : "Cleaner not found for recipient.",
    };
  }

  const config = getNotificationDeliveryConfig();
  const content = buildAssignmentOfferEmail({
    cleanerDisplayName: resolved.recipient.displayName,
    serviceLabel,
    scheduleLabel,
    locationLabel,
    earningsLabel,
    expiresAtLabel,
    offersPageUrl: `${config.appBaseUrl}/cleaner/offers`,
    supportEmail: config.supportEmail,
  });

  const sendResult: SendEmailResult = await emailSender({
    to: resolved.recipient.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sendResult.ok) {
    await markOutboxFailure(client, row, sendResult.error, sendResult.retryable, now);
    return { outcome: "failed", code: "SEND_FAILED", message: sendResult.error };
  }

  await markOutboxSent(client, row.id, row.attempts, now.toISOString());
  return { outcome: "sent" };
}

async function processPaymentFailedRow(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  emailSender: EmailSender,
  now: Date,
): Promise<RowProcessResult> {
  const bookingId = readBookingId(row.payload);
  if (!bookingId) {
    return { outcome: "failed", code: "INVALID_PAYLOAD", message: "Missing bookingId in payload." };
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, status, scheduled_start, scheduled_end, price_cents, metadata")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return { outcome: "failed", code: "BOOKING_NOT_FOUND", message: "Booking not found." };
  }

  if (booking.status !== "payment_failed") {
    await markOutboxFailure(
      client,
      row,
      "Booking no longer payment_failed",
      false,
      now,
    );
    return { outcome: "skipped" };
  }

  if (await hasSentPaymentFailedForBooking(client, bookingId, row.id)) {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped" };
  }

  const resolved = await resolveCustomerEmail(client, row.recipient);
  if (!resolved.ok) {
    return {
      outcome: "failed",
      code: resolved.code,
      message:
        resolved.code === "NO_EMAIL"
          ? "Customer has no email address."
          : "Customer not found for recipient.",
    };
  }

  const failureContext = await loadPaymentFailedNotificationContext(client, booking);
  const config = getNotificationDeliveryConfig();
  const bookingDetailUrl = `${config.appBaseUrl}/customer/bookings/${booking.id}`;
  const content = buildPaymentFailedEmail({
    booking,
    failureReason: failureContext.failureReason,
    canRetry: failureContext.canRetry,
    customerDisplayName: resolved.recipient.displayName,
    bookingDetailUrl,
    supportEmail: config.supportEmail,
  });

  const sendResult: SendEmailResult = await emailSender({
    to: resolved.recipient.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sendResult.ok) {
    await markOutboxFailure(client, row, sendResult.error, sendResult.retryable, now);
    return { outcome: "failed", code: "SEND_FAILED", message: sendResult.error };
  }

  await markOutboxSent(client, row.id, row.attempts, now.toISOString());
  return { outcome: "sent" };
}

async function processOneRow(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  emailSender: EmailSender,
  now: Date,
): Promise<"sent" | "skipped" | "failed"> {
  if (!isDeliverableOutboxRow(row)) {
    return "skipped";
  }

  const nowIso = now.toISOString();
  const claimed = await claimOutboxRow(client, row.id, nowIso);
  if (!claimed) {
    return "skipped";
  }

  const template = readTemplate(row.payload);

  try {
    const result =
      template === ASSIGNMENT_OFFER_TEMPLATE
        ? await processAssignmentOfferRow(client, row, emailSender, now)
        : template === PAYMENT_FAILED_TEMPLATE
          ? await processPaymentFailedRow(client, row, emailSender, now)
          : template === PAYMENT_CONFIRMED_TEMPLATE
            ? await processPaymentConfirmedRow(client, row, emailSender, now)
            : { outcome: "skipped" as const };

    if (result.outcome === "sent") return "sent";
    if (result.outcome === "skipped") return "skipped";

    if (
      result.code === "NO_EMAIL" ||
      result.code === "CUSTOMER_NOT_FOUND" ||
      result.code === "CLEANER_NOT_FOUND"
    ) {
      await markOutboxFailure(client, row, result.message, false, now);
    } else if (
      result.code === "INVALID_PAYLOAD" ||
      result.code === "BOOKING_NOT_FOUND" ||
      result.code === "OFFER_NOT_FOUND" ||
      result.code === "RECIPIENT_MISMATCH"
    ) {
      await markOutboxFailure(client, row, result.message, false, now);
    }
    return "failed";
  } catch (e) {
    const message = e instanceof Error ? e.message : "Notification processing failed.";
    await markOutboxFailure(client, row, message, true, now);
    return "failed";
  }
}

/**
 * Processes pending payment_confirmed, payment_failed, and assignment_offer rows.
 * assignment_offer uses channel push as an email placeholder until real push ships.
 * Other templates stay pending.
 */
export async function processNotificationOutbox(
  client: SupabaseClient<Database>,
  options: {
    emailSender?: EmailSender;
    now?: Date;
    batchSize?: number;
    /** Override NOTIFICATION_PROCESSING_STALE_MINUTES for reclaim step. */
    staleMinutes?: number;
  } = {},
): Promise<ProcessNotificationOutboxResult> {
  const now = options.now ?? new Date();

  const { reclaimed } = await reclaimStaleProcessingNotifications(client, {
    now,
    staleMinutes: options.staleMinutes,
  });

  const empty = (deliveryEnabled: boolean): ProcessNotificationOutboxResult => ({
    ok: true,
    deliveryEnabled,
    reclaimed,
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  });

  if (!canRunNotificationDelivery()) {
    return empty(false);
  }
  const batchSize = options.batchSize ?? NOTIFICATION_OUTBOX_BATCH_SIZE;
  const emailSender = options.emailSender ?? sendEmailViaResend;
  const nowIso = now.toISOString();

  const { data: rows, error } = await client
    .from("notification_outbox")
    .select("*")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .or(buildDeliverableOutboxTemplateOrFilter())
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) {
    throw new Error(error.message);
  }

  const candidates = (rows ?? []).filter(isDeliverableOutboxRow);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: ProcessNotificationOutboxError[] = [];

  for (const row of candidates) {
    try {
      const outcome = await processOneRow(client, row, emailSender, now);
      if (outcome === "sent") sent += 1;
      else if (outcome === "skipped") skipped += 1;
      else failed += 1;
      if (outcome === "failed") {
        errors.push({
          outboxId: row.id,
          code: "PROCESS_FAILED",
          message: "Row processing failed.",
        });
      }
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : "Batch row error.";
      errors.push({
        outboxId: row.id,
        code: "UNEXPECTED_ERROR",
        message: sanitizeErrorMessage(message),
      });
      try {
        await releaseOutboxClaim(client, row.id, nowIso);
      } catch {
        // Best-effort release so a stuck processing row can be retried later.
      }
    }
  }

  return {
    ok: true,
    deliveryEnabled: true,
    reclaimed,
    scanned: candidates.length,
    sent,
    skipped,
    failed,
    errors,
  };
}
