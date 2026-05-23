import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminAssistPaymentLinkActive,
  isAdminAssistPaymentLinkExpired,
  readAdminAssistPaymentLinkMetadata,
} from "@/features/bookings/server/admin/adminAssistPaymentLinkMetadata";
import { buildAdminBookingAssistTimeline } from "@/features/bookings/server/admin/buildAdminBookingAssistTimeline";
import { isAdminAssistedBookingMetadata, isAdminAssistPilotDryRun } from "@/features/bookings/server/admin/adminAssistMetadata";
import { loadAdminBookingAssistAudits } from "@/features/bookings/server/admin/loadAdminBookingAssistAudits";
import { resolveAdminAssistNextRecommendedAction } from "@/features/bookings/server/admin/adminAssistOperatorTimeline";
import { loadAdminAssistedBookingCustomerFieldsByCustomerId } from "@/features/bookings/server/admin/adminAssistedBookingCustomerDisplay";
import { ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE } from "@/features/notifications/server/config";
import type { Database, PaymentStatus } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { BookingStatus } from "@/features/bookings/server/types";

/** Lightweight assist summary for wizard refresh (avoids full booking detail payload). */
export type AdminBookingAssistSummary = {
  id: string;
  customerId: string;
  status: BookingStatus;
  paymentStatus: string | null;
  priceCents: number;
  customerLabel: string;
  customerEmail: string | null;
  customerPhone: string | null;
  customerHasEmail: boolean;
  adminAssistPaymentLink: {
    paymentUrl: string;
    reference: string;
    expiresAt: string;
  } | null;
  adminAssistPaymentTimeline: {
    kind: string;
    deliveryChannel: string | null;
    title: string;
    at: string;
  }[];
  paymentLinkExpired: boolean;
  paymentLinkActive: boolean;
  pendingPaymentAgeHours: number | null;
  failedEmailNotification: boolean;
  lastOperatorLabel: string | null;
  lastOperatorActionAt: string | null;
  offlineEvidenceReference: string | null;
  nextRecommendedAction: { label: string; reason: string } | null;
  pilotDryRun: boolean;
};

export const ADMIN_ASSIST_STALE_PENDING_HOURS = 72;

export async function loadAdminBookingAssistSummary(
  bookingId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminBookingAssistSummary | null> {
  const { data: row, error } = await client
    .from("bookings")
    .select("id, customer_id, status, price_cents, metadata, updated_at")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row || !isAdminAssistedBookingMetadata(row.metadata)) return null;

  const [{ data: paymentRow }, customerFieldsById] = await Promise.all([
    client
      .from("payments")
      .select("status")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadAdminAssistedBookingCustomerFieldsByCustomerId(client, [row.customer_id]),
  ]);

  const customerFields = customerFieldsById.get(row.customer_id) ?? {
    customer_name: null,
    customer_email: null,
    customer_phone: null,
  };

  const audits = await loadAdminBookingAssistAudits(client, bookingId);
  const paymentLink = readAdminAssistPaymentLinkMetadata(row.metadata);
  const nowMs = Date.now();
  const timeline = buildAdminBookingAssistTimeline({
    audits,
    bookingStatus: row.status as BookingStatus,
    paymentLink,
    paymentConfirmedAt: POST_PAYMENT.has(row.status) ? row.updated_at : null,
  });

  const failedEmailNotification = await hasFailedPaymentRequestEmail(client, bookingId);

  const lastAudit = audits.at(-1);
  let lastOperatorLabel: string | null = null;
  if (lastAudit?.adminProfileId) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", lastAudit.adminProfileId)
      .maybeSingle();
    lastOperatorLabel = profile?.full_name?.trim() || null;
  }

  const offlineAudit = [...audits]
    .reverse()
    .find((a) => a.action === "admin_booking_offline_payment_recorded");
  const offlinePayload =
    offlineAudit?.payload && typeof offlineAudit.payload === "object"
      ? (offlineAudit.payload as Record<string, unknown>)
      : null;
  const offlineEvidenceReference =
    (typeof offlinePayload?.evidenceReference === "string" && offlinePayload.evidenceReference) ||
    (typeof offlinePayload?.reference === "string" && offlinePayload.reference) ||
    null;

  const pendingPaymentAgeHours =
    row.status === "pending_payment"
      ? Math.round(((nowMs - Date.parse(row.updated_at)) / 3_600_000) * 10) / 10
      : null;

  const customerEmail = customerFields.customer_email?.trim() || null;

  return {
    id: row.id,
    customerId: row.customer_id,
    status: row.status as BookingStatus,
    paymentStatus: (paymentRow?.status as PaymentStatus | undefined) ?? null,
    priceCents: row.price_cents,
    customerLabel:
      customerFields.customer_name?.trim() ||
      customerEmail ||
      row.customer_id.slice(0, 8),
    customerEmail,
    customerPhone: customerFields.customer_phone?.trim() || null,
    customerHasEmail: Boolean(customerEmail),
    adminAssistPaymentLink: paymentLink
      ? {
          paymentUrl: paymentLink.paymentUrl,
          reference: paymentLink.reference,
          expiresAt: paymentLink.expiresAt,
        }
      : null,
    adminAssistPaymentTimeline: timeline.map((entry) => ({
      kind: entry.kind,
      deliveryChannel: entry.deliveryChannel,
      title: entry.title,
      at: entry.at,
    })),
    paymentLinkExpired: paymentLink ? isAdminAssistPaymentLinkExpired(paymentLink, nowMs) : false,
    paymentLinkActive: paymentLink ? isAdminAssistPaymentLinkActive(paymentLink, nowMs) : false,
    pendingPaymentAgeHours,
    failedEmailNotification,
    lastOperatorLabel,
    lastOperatorActionAt: lastAudit?.createdAt ?? null,
    offlineEvidenceReference,
    nextRecommendedAction: resolveAdminAssistNextRecommendedAction({
      bookingStatus: row.status,
      paymentLinkExpired: paymentLink ? isAdminAssistPaymentLinkExpired(paymentLink, nowMs) : false,
      hasPaymentLink: Boolean(paymentLink),
      customerHasEmail: Boolean(customerEmail),
      emailFailed: failedEmailNotification,
      bookingConfirmed: POST_PAYMENT.has(row.status),
    }),
    pilotDryRun: isAdminAssistPilotDryRun(row.metadata),
  };
}

const POST_PAYMENT = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

async function hasFailedPaymentRequestEmail(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<boolean> {
  const { count, error } = await client
    .from("notification_outbox")
    .select("id", { count: "exact", head: true })
    .filter("payload->>template", "eq", ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE)
    .eq("status", "failed")
    .contains("payload", { bookingId });

  if (error) return false;
  return (count ?? 0) > 0;
}

export function isAdminAssistPendingPaymentStale(ageHours: number | null): boolean {
  return ageHours != null && ageHours >= ADMIN_ASSIST_STALE_PENDING_HOURS;
}
