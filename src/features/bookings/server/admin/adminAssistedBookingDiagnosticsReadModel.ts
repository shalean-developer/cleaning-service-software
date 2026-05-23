import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminAssistedBookingMetadata } from "@/features/bookings/server/admin/adminAssistMetadata";
import {
  isAdminAssistPaymentLinkActive,
  isAdminAssistPaymentLinkExpired,
  readAdminAssistPaymentLinkMetadata,
} from "@/features/bookings/server/admin/adminAssistPaymentLinkMetadata";
import type { Database } from "@/lib/database/types";
import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";
import { isAdminAssistedOfflinePaymentsActive } from "@/lib/app/adminAssistedOfflinePaymentsFlag";
import { isAdminAssistedPaymentLinksActive } from "@/lib/app/adminAssistedPaymentLinksFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

const ASSIST_BOOKING_SCAN_LIMIT = 500;

const POST_PAYMENT_STATUSES = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

export type AdminAssistedBookingDiagnostics = {
  generatedAt: string;
  readOnly: true;
  featureFlags: {
    bookingEnabled: boolean;
    paymentLinksEnabled: boolean;
    offlinePaymentsEnabled: boolean;
  };
  counts: {
    assistedDrafts: number;
    pendingPayment: number;
    paymentLinksActive: number;
    paymentLinksExpired: number;
    offlinePaymentsRecorded: number;
    offlinePaymentsFinalized: number;
    offlinePaymentsFailed: number;
    confirmedAfterAssistPayment: number;
    failedPaymentRequestNotifications: number;
    assignmentDispatchAttention: number;
  };
  scan: {
    bookingsScanned: number;
    capped: boolean;
  };
};

export async function loadAdminAssistedBookingDiagnostics(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedBookingDiagnostics> {
  const generatedAt = new Date().toISOString();

  const [
    bookingsRes,
    offlineRecordedRes,
    offlineFinalizedRes,
    offlineFailedRes,
    failedNotificationsRes,
  ] = await Promise.all([
    client
      .from("bookings")
      .select("id, status, metadata, cleaner_id, assignment_dispatch_at")
      .or(
        "metadata->adminAssist->>source.eq.admin_wizard,metadata->adminAssist->>phase.eq.draft_only",
      )
      .order("updated_at", { ascending: false })
      .limit(ASSIST_BOOKING_SCAN_LIMIT + 1),
    client
      .from("admin_offline_payment_events")
      .select("id", { count: "exact", head: true }),
    client
      .from("admin_offline_payment_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "finalized"),
    client
      .from("admin_offline_payment_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    client
      .from("notification_outbox")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "admin_assisted_payment_request_sent")
      .eq("status", "failed"),
  ]);

  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (offlineRecordedRes.error) throw new Error(offlineRecordedRes.error.message);
  if (offlineFinalizedRes.error) throw new Error(offlineFinalizedRes.error.message);
  if (offlineFailedRes.error) throw new Error(offlineFailedRes.error.message);
  if (failedNotificationsRes.error) throw new Error(failedNotificationsRes.error.message);

  const rows = bookingsRes.data ?? [];
  const capped = rows.length > ASSIST_BOOKING_SCAN_LIMIT;
  const bookings = capped ? rows.slice(0, ASSIST_BOOKING_SCAN_LIMIT) : rows;
  const nowMs = Date.now();

  let assistedDrafts = 0;
  let pendingPayment = 0;
  let paymentLinksActive = 0;
  let paymentLinksExpired = 0;
  let confirmedAfterAssistPayment = 0;
  let assignmentDispatchAttention = 0;

  for (const row of bookings) {
    if (!isAdminAssistedBookingMetadata(row.metadata)) continue;

    if (row.status === "draft") assistedDrafts += 1;
    if (row.status === "pending_payment") pendingPayment += 1;

    const link = readAdminAssistPaymentLinkMetadata(row.metadata);
    if (link) {
      if (isAdminAssistPaymentLinkActive(link, nowMs)) paymentLinksActive += 1;
      if (isAdminAssistPaymentLinkExpired(link, nowMs)) paymentLinksExpired += 1;
    }

    if (POST_PAYMENT_STATUSES.has(row.status)) {
      confirmedAfterAssistPayment += 1;
    }

    if (row.status === "pending_assignment" && !row.cleaner_id && !row.assignment_dispatch_at) {
      assignmentDispatchAttention += 1;
    }
  }

  return {
    generatedAt,
    readOnly: true,
    featureFlags: {
      bookingEnabled: isAdminAssistedBookingEnabled(),
      paymentLinksEnabled: isAdminAssistedPaymentLinksActive(),
      offlinePaymentsEnabled: isAdminAssistedOfflinePaymentsActive(),
    },
    counts: {
      assistedDrafts,
      pendingPayment,
      paymentLinksActive,
      paymentLinksExpired,
      offlinePaymentsRecorded: offlineRecordedRes.count ?? 0,
      offlinePaymentsFinalized: offlineFinalizedRes.count ?? 0,
      offlinePaymentsFailed: offlineFailedRes.count ?? 0,
      confirmedAfterAssistPayment,
      failedPaymentRequestNotifications: failedNotificationsRes.count ?? 0,
      assignmentDispatchAttention,
    },
    scan: {
      bookingsScanned: bookings.length,
      capped,
    },
  };
}
