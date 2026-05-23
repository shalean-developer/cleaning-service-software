import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAssistedBookingAlert } from "./adminAssistedBookingAlerts";
import { countAlertsBySeverity } from "./adminAssistedRolloutHealth";
import {
  computeAdminAssistedBookingIncidents,
  type AdminAssistedBookingIncident,
} from "./adminAssistedBookingIncidents";
import {
  computeAdminAssistedBookingFriction,
  type AdminAssistedBookingFrictionBooking,
} from "./adminAssistedBookingFriction";
import { loadAdminAssistedBookingDiagnostics } from "./adminAssistedBookingDiagnosticsReadModel";
import type { AdminAssistedBookingDiagnostics } from "./adminAssistedBookingDiagnosticsReadModel";
import { enrichFrictionBookingsWithRecurringMaterialization } from "./enrichFrictionBookingsWithRecurringMaterialization";
import { evaluateAdminAssistedRolloutReadiness } from "./adminAssistedRolloutReadiness";
import type { AdminAssistedRolloutReadiness } from "./adminAssistedRolloutReadiness";
import {
  computeAdminAssistedRolloutHealth,
  type AdminAssistedRolloutHealth,
} from "./adminAssistedRolloutHealth";
import {
  getAdminAssistedObservabilityMetrics,
  recordProductionLoadDuration,
  recordRecurringEnrichmentDuration,
  type AdminAssistedObservabilityMetrics,
} from "./adminAssistedProductionObservability";
import { isAdminAssistedBookingMetadata } from "./adminAssistMetadata";
import { ADMIN_ASSIST_STALE_PENDING_HOURS } from "./loadAdminBookingAssistSummary";
import { listProductionRolloutChecklist } from "@/features/production-rollout/server/productionRolloutChecklistRepository";
import {
  customerLabelFromCustomerFields,
  withAdminAssistedBookingCustomerFields,
} from "./adminAssistedBookingCustomerDisplay";
import { ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE } from "@/features/notifications/server/config";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

const RECENT_EVENT_LIMIT = 15;
const PRODUCTION_BOOKING_SCAN = 500;

export type AdminAssistedProductionLiveMetrics = {
  activeAssistedBookings: number;
  pendingPayments: number;
  confirmedToday: number;
  offlineEftToday: number;
  failedPaymentRequests: number;
  recurringMaterializationFailures: number;
  orphanConfirmedBookings: number;
  assignmentDispatchFailures: number;
  stalePendingOver72h: number;
};

export type AdminAssistedProductionRecentEvent = {
  id: string;
  at: string;
  kind:
    | "payment_confirmed"
    | "offline_recorded"
    | "recurring_materialized"
    | "notification_failed"
    | "assignment_escalation"
    | "link_regenerated";
  title: string;
  bookingId: string | null;
  customerLabel: string | null;
  severity: AdminAssistedBookingAlert["severity"];
};

export type AdminAssistedProductionStatus = {
  generatedAt: string;
  readOnly: true;
  diagnostics: AdminAssistedBookingDiagnostics;
  readiness: AdminAssistedRolloutReadiness;
  health: AdminAssistedRolloutHealth;
  liveMetrics: AdminAssistedProductionLiveMetrics;
  alertCountsBySeverity: Record<AdminAssistedBookingAlert["severity"], number>;
  activeIncidents: AdminAssistedBookingIncident[];
  unresolvedAlerts: AdminAssistedBookingAlert[];
  recentPaymentConfirmations: AdminAssistedProductionRecentEvent[];
  recentRecurringMaterializations: AdminAssistedProductionRecentEvent[];
  recentOfflineRecordings: AdminAssistedProductionRecentEvent[];
  recentFailedNotifications: AdminAssistedProductionRecentEvent[];
  recentAssignmentEscalations: AdminAssistedProductionRecentEvent[];
  observability: AdminAssistedObservabilityMetrics;
};

function startOfTodayIso(now = new Date()): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function customerLabelFromRow(row: {
  customer_name: string | null;
  customer_email: string | null;
  id: string;
}): string {
  return customerLabelFromCustomerFields(row, row.id);
}

export async function loadAdminAssistedProductionStatus(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedProductionStatus> {
  const startedAt = Date.now();
  const generatedAt = new Date().toISOString();
  const todayStart = startOfTodayIso();

  const [diagnostics, checklist, bookingsRes, auditsRes, offlineTodayRes, failedNotificationsRes] =
    await Promise.all([
      loadAdminAssistedBookingDiagnostics(client),
      listProductionRolloutChecklist(client),
      client
        .from("bookings")
        .select(
          "id, status, metadata, updated_at, created_at, customer_id, assignment_dispatch_at, cleaner_id",
        )
        .or(
          "metadata->adminAssist->>source.eq.admin_wizard,metadata->adminAssist->>phase.eq.draft_only",
        )
        .order("updated_at", { ascending: false })
        .limit(PRODUCTION_BOOKING_SCAN),
      client
        .from("admin_booking_assist_audit")
        .select("booking_id, action, created_at, payload, admin_profile_id")
        .order("created_at", { ascending: false })
        .limit(2000),
      client
        .from("admin_offline_payment_events")
        .select("id, booking_id, rail, created_at, status")
        .gte("created_at", todayStart)
        .order("created_at", { ascending: false })
        .limit(RECENT_EVENT_LIMIT),
      client
        .from("notification_outbox")
        .select("id, payload, created_at")
        .filter("payload->>template", "eq", ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(RECENT_EVENT_LIMIT),
    ]);

  if (bookingsRes.error) throw new Error(bookingsRes.error.message);
  if (auditsRes.error) throw new Error(auditsRes.error.message);
  if (offlineTodayRes.error) throw new Error(offlineTodayRes.error.message);
  if (failedNotificationsRes.error) throw new Error(failedNotificationsRes.error.message);

  const bookingRowsRaw = (bookingsRes.data ?? []).filter((row) =>
    isAdminAssistedBookingMetadata(row.metadata),
  );
  const bookingRows = await withAdminAssistedBookingCustomerFields(client, bookingRowsRaw);
  const bookingById = new Map(bookingRows.map((row) => [row.id, row]));

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

  const { flaggedBookings } = computeAdminAssistedBookingFriction(
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

  const enrichStarted = Date.now();
  const enrichedFlagged = await enrichFrictionBookingsWithRecurringMaterialization(
    client,
    flaggedBookings,
  );
  recordRecurringEnrichmentDuration(Date.now() - enrichStarted);

  for (const booking of enrichedFlagged) {
    if (
      booking.recurringCadence &&
      booking.recurringCadence !== "once" &&
      !booking.recurringGroupId &&
      booking.status !== "draft" &&
      booking.status !== "pending_payment"
    ) {
      if (!booking.flags.includes("recurring_materialization_failed")) {
        booking.flags.push("recurring_materialization_failed");
      }
    }
  }

  const readiness = evaluateAdminAssistedRolloutReadiness(checklist);
  const health = computeAdminAssistedRolloutHealth({
    alerts: diagnostics.alerts,
    counts: diagnostics.counts,
    analytics: diagnostics.analytics,
    friction: diagnostics.friction,
    readiness,
  });

  const activeIncidents = computeAdminAssistedBookingIncidents(enrichedFlagged);
  const unresolvedAlerts = diagnostics.alerts.filter((a) => a.count > 0);

  const terminalStatuses = new Set(["completed", "cancelled", "payment_failed"]);
  const activeAssistedBookings = bookingRows.filter((b) => !terminalStatuses.has(b.status)).length;

  const confirmedToday = bookingRows.filter(
    (b) =>
      ["confirmed", "pending_assignment", "assigned", "in_progress"].includes(b.status) &&
      (b.updated_at ?? b.created_at) >= todayStart,
  ).length;

  const offlineEftToday = (offlineTodayRes.data ?? []).filter(
    (e) => e.rail === "eft" && e.status === "finalized",
  ).length;

  const recurringMaterializationFailures = enrichedFlagged.filter((b) =>
    b.flags.includes("recurring_materialization_failed"),
  ).length;

  const liveMetrics: AdminAssistedProductionLiveMetrics = {
    activeAssistedBookings,
    pendingPayments: diagnostics.counts.pendingPayment,
    confirmedToday,
    offlineEftToday,
    failedPaymentRequests: diagnostics.counts.failedPaymentRequestNotifications,
    recurringMaterializationFailures,
    orphanConfirmedBookings: diagnostics.counts.confirmedWithoutAssignmentDispatch,
    assignmentDispatchFailures: diagnostics.counts.assignmentDispatchAttention,
    stalePendingOver72h: diagnostics.counts.stalePendingPayment,
  };

  function recentFromAudits(
    action: string,
    kind: AdminAssistedProductionRecentEvent["kind"],
    title: string,
    severity: AdminAssistedProductionRecentEvent["severity"],
  ): AdminAssistedProductionRecentEvent[] {
    return (auditsRes.data ?? [])
      .filter((row) => row.action === action)
      .slice(0, RECENT_EVENT_LIMIT)
      .map((row) => {
        const booking = row.booking_id ? bookingById.get(row.booking_id) : undefined;
        return {
          id: `${action}-${row.created_at}-${row.booking_id ?? "none"}`,
          at: row.created_at,
          kind,
          title,
          bookingId: row.booking_id,
          customerLabel: booking ? customerLabelFromRow(booking) : null,
          severity,
        };
      });
  }

  const recentPaymentConfirmations = bookingRows
    .filter(
      (b) =>
        ["confirmed", "pending_assignment", "assigned"].includes(b.status) &&
        (b.updated_at ?? b.created_at) >= todayStart,
    )
    .slice(0, RECENT_EVENT_LIMIT)
    .map((row) => ({
      id: `confirmed-${row.id}`,
      at: row.updated_at ?? row.created_at,
      kind: "payment_confirmed" as const,
      title: "Payment confirmed",
      bookingId: row.id,
      customerLabel: customerLabelFromRow(row),
      severity: "info" as const,
    }));

  const recentOfflineRecordings = (offlineTodayRes.data ?? []).map((row) => {
    const booking = bookingById.get(row.booking_id);
    return {
      id: row.id,
      at: row.created_at,
      kind: "offline_recorded" as const,
      title: `Offline ${row.rail} recorded (${row.status})`,
      bookingId: row.booking_id,
      customerLabel: booking ? customerLabelFromRow(booking) : null,
      severity: row.status === "failed" ? ("warning" as const) : ("info" as const),
    };
  });

  const recentFailedNotifications = (failedNotificationsRes.data ?? []).map((row) => {
    const payload = row.payload;
    const bookingId =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? String((payload as Record<string, unknown>).bookingId ?? "")
        : "";
    const booking = bookingId ? bookingById.get(bookingId) : undefined;
    return {
      id: row.id,
      at: row.created_at,
      kind: "notification_failed" as const,
      title: "Payment request notification failed",
      bookingId: bookingId || null,
      customerLabel: booking ? customerLabelFromRow(booking) : null,
      severity: "high" as const,
    };
  });

  const recentRecurringMaterializations = enrichedFlagged
    .filter((b) => b.recurringGroupId && b.recurringMaterializationStatus === "succeeded")
    .slice(0, RECENT_EVENT_LIMIT)
    .map((b) => ({
      id: `recurring-${b.bookingId}`,
      at: generatedAt,
      kind: "recurring_materialized" as const,
      title: "Recurring series materialized",
      bookingId: b.bookingId,
      customerLabel: b.customerLabel,
      severity: "info" as const,
    }));

  const recentAssignmentEscalations = enrichedFlagged
    .filter(
      (b) =>
        b.status === "confirmed" ||
        b.status === "pending_assignment" ||
        b.flags.includes("high_operator_actions"),
    )
    .slice(0, RECENT_EVENT_LIMIT)
    .map((b) => ({
      id: `assignment-${b.bookingId}`,
      at: generatedAt,
      kind: "assignment_escalation" as const,
      title:
        b.status === "confirmed"
          ? "Confirmed — assignment dispatch attention"
          : "Assignment escalation",
      bookingId: b.bookingId,
      customerLabel: b.customerLabel,
      severity: b.status === "confirmed" ? ("critical" as const) : ("high" as const),
    }));

  const recentLinkRegenerations = recentFromAudits(
    "admin_booking_payment_link_regenerated",
    "link_regenerated",
    "Payment link regenerated",
    "warning",
  );

  recordProductionLoadDuration(Date.now() - startedAt);

  return {
    generatedAt,
    readOnly: true,
    diagnostics,
    readiness,
    health,
    liveMetrics,
    alertCountsBySeverity: countAlertsBySeverity(diagnostics.alerts),
    activeIncidents,
    unresolvedAlerts,
    recentPaymentConfirmations,
    recentRecurringMaterializations,
    recentOfflineRecordings,
    recentFailedNotifications,
    recentAssignmentEscalations: [...recentAssignmentEscalations, ...recentLinkRegenerations].slice(
      0,
      RECENT_EVENT_LIMIT,
    ),
    observability: getAdminAssistedObservabilityMetrics(),
  };
}

/** @internal exported for tests */
export { startOfTodayIso };
