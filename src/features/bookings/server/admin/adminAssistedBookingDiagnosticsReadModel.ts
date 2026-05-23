import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminAssistedBookingMetadata } from "@/features/bookings/server/admin/adminAssistMetadata";
import {
  isAdminAssistPaymentLinkActive,
  isAdminAssistPaymentLinkExpired,
  readAdminAssistPaymentLinkMetadata,
} from "@/features/bookings/server/admin/adminAssistPaymentLinkMetadata";
import { ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE } from "@/features/notifications/server/config";
import type { Database } from "@/lib/database/types";
import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";
import { isAdminAssistedOfflinePaymentsActive } from "@/lib/app/adminAssistedOfflinePaymentsFlag";
import { isAdminAssistedPaymentLinksActive } from "@/lib/app/adminAssistedPaymentLinksFlag";
import { computeAdminAssistedBookingAnalytics } from "@/features/bookings/server/admin/adminAssistedBookingAnalytics";
import type { AdminAssistedBookingAnalytics } from "@/features/bookings/server/admin/adminAssistedBookingAnalytics";
import {
  computeAdminAssistedBookingFriction,
  type AdminAssistedBookingFrictionMetrics,
} from "@/features/bookings/server/admin/adminAssistedBookingFriction";
import { computeAdminAssistedBookingAlerts } from "@/features/bookings/server/admin/adminAssistedBookingAlerts";
import type { AdminAssistedBookingAlert } from "@/features/bookings/server/admin/adminAssistedBookingAlerts";
import {
  resolveAdminAssistedBookingRolloutStage,
  type AdminAssistedBookingRolloutStage,
} from "@/lib/app/resolveAdminAssistedBookingRolloutStage";
import { ADMIN_ASSIST_STALE_PENDING_HOURS } from "@/features/bookings/server/admin/loadAdminBookingAssistSummary";
import {
  customerLabelFromCustomerFields,
  withAdminAssistedBookingCustomerFields,
} from "@/features/bookings/server/admin/adminAssistedBookingCustomerDisplay";

import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

const ASSIST_BOOKING_SCAN_LIMIT = 500;
const ASSIST_AUDIT_SCAN_LIMIT = 2000;

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
    awaitingPayment: number;
    paymentLinksActive: number;
    paymentLinksExpired: number;
    stalePendingPayment: number;
    offlinePaymentsRecorded: number;
    offlinePaymentsFinalized: number;
    offlinePaymentsFailed: number;
    confirmedAfterAssistPayment: number;
    failedPaymentRequestNotifications: number;
    assignmentDispatchAttention: number;
    confirmedWithoutAssignmentDispatch: number;
  };
  alerts: AdminAssistedBookingAlert[];
  rolloutStage: AdminAssistedBookingRolloutStage;
  analytics: AdminAssistedBookingAnalytics;
  friction: AdminAssistedBookingFrictionMetrics;
  operatorFeedbackCount: number;
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
    auditsRes,
    feedbackCountRes,
    failedNotificationRowsRes,
  ] = await Promise.all([
    client
      .from("bookings")
      .select(
        "id, status, metadata, cleaner_id, assignment_dispatch_at, updated_at, created_at, customer_id",
      )
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
      .filter("payload->>template", "eq", ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE)
      .eq("status", "failed"),
    client
      .from("admin_booking_assist_audit")
      .select("booking_id, action, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(ASSIST_AUDIT_SCAN_LIMIT),
    client
      .from("admin_assisted_operator_feedback")
      .select("id", { count: "exact", head: true }),
    client
      .from("notification_outbox")
      .select("payload")
      .filter("payload->>template", "eq", ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE)
      .eq("status", "failed")
      .limit(500),
  ]);

  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (offlineRecordedRes.error) throw new Error(offlineRecordedRes.error.message);
  if (offlineFinalizedRes.error) throw new Error(offlineFinalizedRes.error.message);
  if (offlineFailedRes.error) throw new Error(offlineFailedRes.error.message);
  if (failedNotificationsRes.error) throw new Error(failedNotificationsRes.error.message);
  if (auditsRes.error) throw new Error(auditsRes.error.message);
  if (feedbackCountRes.error) throw new Error(feedbackCountRes.error.message);
  if (failedNotificationRowsRes.error) throw new Error(failedNotificationRowsRes.error.message);

  const rows = bookingsRes.data ?? [];
  const capped = rows.length > ASSIST_BOOKING_SCAN_LIMIT;
  const bookings = capped ? rows.slice(0, ASSIST_BOOKING_SCAN_LIMIT) : rows;
  const nowMs = Date.now();

  let assistedDrafts = 0;
  let pendingPayment = 0;
  let paymentLinksActive = 0;
  let paymentLinksExpired = 0;
  let awaitingPayment = 0;
  let stalePendingPayment = 0;
  let confirmedAfterAssistPayment = 0;
  let assignmentDispatchAttention = 0;
  let confirmedWithoutAssignmentDispatch = 0;
  const paidBookingIds = new Set<string>();

  for (const row of bookings) {
    if (!isAdminAssistedBookingMetadata(row.metadata)) continue;

    if (row.status === "draft") assistedDrafts += 1;
    if (row.status === "pending_payment") {
      pendingPayment += 1;
      const ageHours = (nowMs - Date.parse(String(row.updated_at ?? row.created_at ?? nowMs))) / 3_600_000;
      if (ageHours >= ADMIN_ASSIST_STALE_PENDING_HOURS) stalePendingPayment += 1;
    }

    const link = readAdminAssistPaymentLinkMetadata(row.metadata);
    if (link) {
      if (isAdminAssistPaymentLinkActive(link, nowMs)) {
        paymentLinksActive += 1;
        if (row.status === "pending_payment") awaitingPayment += 1;
      }
      if (isAdminAssistPaymentLinkExpired(link, nowMs)) paymentLinksExpired += 1;
    } else if (row.status === "pending_payment") {
      awaitingPayment += 1;
    }

    if (POST_PAYMENT_STATUSES.has(row.status)) {
      confirmedAfterAssistPayment += 1;
      paidBookingIds.add(row.id);
    }

    if (row.status === "pending_assignment" && !row.cleaner_id && !row.assignment_dispatch_at) {
      assignmentDispatchAttention += 1;
    }

    if (row.status === "confirmed") {
      confirmedWithoutAssignmentDispatch += 1;
    }
  }

  const auditEvents = (auditsRes.data ?? []).map((row) => ({
    bookingId: row.booking_id,
    action: row.action,
    createdAt: row.created_at,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {},
  }));

  const analytics = computeAdminAssistedBookingAnalytics(auditEvents, paidBookingIds, new Date(nowMs));

  const failedNotificationBookingIds = new Set<string>();
  for (const row of failedNotificationRowsRes.data ?? []) {
    const payload = row.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const bookingId = (payload as Record<string, unknown>).bookingId;
      if (typeof bookingId === "string" && bookingId.trim()) {
        failedNotificationBookingIds.add(bookingId.trim());
      }
    }
  }

  const bookingsWithCustomer = await withAdminAssistedBookingCustomerFields(client, bookings);

  const { metrics: friction, flaggedBookings } = computeAdminAssistedBookingFriction(
    bookingsWithCustomer.map((row) => ({
      id: row.id,
      status: row.status,
      metadata: row.metadata,
      updated_at: row.updated_at,
      created_at: row.created_at,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
    })),
    auditEvents,
    {
      stalePendingHours: ADMIN_ASSIST_STALE_PENDING_HOURS,
      failedNotificationBookingIds,
      nowMs,
    },
  );

  const alerts = computeAdminAssistedBookingAlerts({
    counts: {
      assistedDrafts,
      pendingPayment,
      awaitingPayment,
      paymentLinksActive,
      paymentLinksExpired,
      stalePendingPayment,
      offlinePaymentsRecorded: offlineRecordedRes.count ?? 0,
      offlinePaymentsFinalized: offlineFinalizedRes.count ?? 0,
      offlinePaymentsFailed: offlineFailedRes.count ?? 0,
      confirmedAfterAssistPayment,
      failedPaymentRequestNotifications: failedNotificationsRes.count ?? 0,
      assignmentDispatchAttention,
      confirmedWithoutAssignmentDispatch,
    },
    analytics,
    friction,
    flaggedBookings,
  });

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
      awaitingPayment,
      paymentLinksActive,
      paymentLinksExpired,
      stalePendingPayment,
      offlinePaymentsRecorded: offlineRecordedRes.count ?? 0,
      offlinePaymentsFinalized: offlineFinalizedRes.count ?? 0,
      offlinePaymentsFailed: offlineFailedRes.count ?? 0,
      confirmedAfterAssistPayment,
      failedPaymentRequestNotifications: failedNotificationsRes.count ?? 0,
      assignmentDispatchAttention,
      confirmedWithoutAssignmentDispatch,
    },
    alerts,
    rolloutStage: resolveAdminAssistedBookingRolloutStage(),
    analytics,
    friction,
    operatorFeedbackCount: feedbackCountRes.count ?? 0,
    scan: {
      bookingsScanned: bookings.length,
      capped,
    },
  };
}
