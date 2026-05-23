import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminAssistedBookingMetadata } from "@/features/bookings/server/admin/adminAssistMetadata";
import {
  computeAdminAssistedBookingFriction,
  type AdminAssistedBookingFrictionBooking,
  type AdminAssistedBookingFrictionMetrics,
} from "@/features/bookings/server/admin/adminAssistedBookingFriction";
import { loadAdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";
import type { AdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";
import { loadRecentAdminAssistedOperatorFeedback } from "@/features/bookings/server/admin/loadAdminAssistedOperatorFeedback";
import type { AdminAssistedOperatorFeedback } from "@/features/bookings/server/admin/loadAdminAssistedOperatorFeedback";
import { enrichFrictionBookingsWithRecurringMaterialization } from "@/features/bookings/server/admin/enrichFrictionBookingsWithRecurringMaterialization";
import { withAdminAssistedBookingCustomerFields } from "@/features/bookings/server/admin/adminAssistedBookingCustomerDisplay";
import { ADMIN_ASSIST_STALE_PENDING_HOURS } from "@/features/bookings/server/admin/loadAdminBookingAssistSummary";
import { ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE } from "@/features/notifications/server/config";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

const PILOT_BOOKING_SCAN_LIMIT = 500;
const PILOT_AUDIT_SCAN_LIMIT = 2000;

export type AdminAssistedPilotQaPanel = {
  generatedAt: string;
  readOnly: true;
  diagnostics: AdminAssistedBookingDiagnostics;
  friction: AdminAssistedBookingFrictionMetrics;
  flaggedBookings: AdminAssistedBookingFrictionBooking[];
  dryRunBookings: AdminAssistedBookingFrictionBooking[];
  recentFeedback: AdminAssistedOperatorFeedback[];
  feedbackCount: number;
};

export async function loadAdminAssistedPilotQaPanel(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedPilotQaPanel> {
  const generatedAt = new Date().toISOString();

  const [diagnostics, bookingsRes, auditsRes, feedbackRes, failedNotificationsRes] =
    await Promise.all([
      loadAdminAssistedBookingDiagnostics(client),
      client
        .from("bookings")
        .select("id, status, metadata, updated_at, created_at, customer_id")
        .or(
          "metadata->adminAssist->>source.eq.admin_wizard,metadata->adminAssist->>phase.eq.draft_only",
        )
        .order("updated_at", { ascending: false })
        .limit(PILOT_BOOKING_SCAN_LIMIT + 1),
      client
        .from("admin_booking_assist_audit")
        .select("booking_id, action, created_at, payload")
        .order("created_at", { ascending: false })
        .limit(PILOT_AUDIT_SCAN_LIMIT),
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
  if (auditsRes.error) throw new Error(auditsRes.error.message);
  if (feedbackRes.error) throw new Error(feedbackRes.error.message);
  if (failedNotificationsRes.error) throw new Error(failedNotificationsRes.error.message);

  const bookingRowsRaw = (bookingsRes.data ?? []).filter((row) =>
    isAdminAssistedBookingMetadata(row.metadata),
  );
  const bookingRows = await withAdminAssistedBookingCustomerFields(client, bookingRowsRaw);

  const failedNotificationBookingIds = new Set<string>();
  for (const row of failedNotificationsRes.data ?? []) {
    const payload = row.payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const bookingId = (payload as Record<string, unknown>).bookingId;
      if (typeof bookingId === "string" && bookingId.trim()) {
        failedNotificationBookingIds.add(bookingId.trim());
      }
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

  const { metrics, flaggedBookings } = computeAdminAssistedBookingFriction(
    bookingRows.map((row) => ({
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
    },
  );

  const dryRunBookings = flaggedBookings.filter((b) => b.pilotDryRun);
  const recentFeedback = await loadRecentAdminAssistedOperatorFeedback(20, client);

  const enrichedFlagged = await enrichFrictionBookingsWithRecurringMaterialization(
    client,
    flaggedBookings,
  );
  const enrichedDryRun = await enrichFrictionBookingsWithRecurringMaterialization(
    client,
    dryRunBookings,
  );

  return {
    generatedAt,
    readOnly: true,
    diagnostics,
    friction: metrics,
    flaggedBookings: enrichedFlagged.slice(0, 50),
    dryRunBookings: enrichedDryRun.slice(0, 50),
    recentFeedback,
    feedbackCount: feedbackRes.count ?? 0,
  };
}
