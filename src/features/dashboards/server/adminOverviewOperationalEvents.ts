import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStateAuditRow } from "@/lib/database/types";
import type { AdminOperationalAuditRow } from "@/features/admin/server/adminOperationalAuditTypes";
import type { BookingStatus } from "@/features/bookings/server/types";
import { labelForBookingStatus } from "@/features/bookings/server/statusLabels";
import { describeBookingStateAuditDisplay } from "./adminOperationalHelpers";
import { ADMIN_OPERATIONAL_AUDIT_ACTION_LABELS } from "@/features/admin/server/mapAdminOperationalAuditRow";

const BOOKING_AUDIT_FETCH_LIMIT = 60;
const ADMIN_AUDIT_FETCH_LIMIT = 30;

/** Lifecycle commands surfaced on the admin home feed (no raw telemetry / noise). */
const BOOKING_AUDIT_FEED_COMMANDS = new Set([
  "FINALIZE_PAYMENT_SUCCESS",
  "CONFIRM_PAYMENT",
  "MARK_PAYMENT_FAILED",
  "MOVE_TO_PENDING_ASSIGNMENT",
  "OFFER_TO_CLEANER",
  "ACCEPT_CLEANER_ASSIGNMENT",
  "RECORD_ASSIGNMENT_OFFER_EXPIRED",
  "EXPIRE_ASSIGNMENT_OFFER",
  "MARK_IN_PROGRESS",
  "MARK_COMPLETED",
  "MARK_PAYOUT_READY",
  "MARK_PAID_OUT",
  "CANCEL_BOOKING",
]);

const ADMIN_AUDIT_FEED_ACTIONS = new Set([
  "assignment_recovery",
  "deferred_dispatch_now",
  "manual_dispatch_offer",
  "replace_open_offer",
  "notification_requeue",
]);

const ADMIN_AUDIT_FEED_OUTCOMES = new Set(["success", "idempotent"]);

export type AdminOverviewOperationalEvent = {
  id: string;
  /** Null when append-only audit was orphaned after operational reset. */
  bookingId: string | null;
  at: string;
  source: "booking_audit" | "admin_audit";
  kind:
    | "assignment"
    | "confirmed"
    | "support"
    | "risk"
    | "completed"
    | "recurring"
    | "payment";
  title: string;
  detail: string | null;
};

function mapBookingAuditKind(
  command: string | null,
  toStatus: BookingStatus | null,
): AdminOverviewOperationalEvent["kind"] {
  if (command === "MARK_PAYMENT_FAILED") return "payment";
  if (command === "FINALIZE_PAYMENT_SUCCESS" || command === "CONFIRM_PAYMENT") return "payment";
  if (
    command === "OFFER_TO_CLEANER" ||
    command === "MOVE_TO_PENDING_ASSIGNMENT" ||
    command === "RECORD_ASSIGNMENT_OFFER_EXPIRED" ||
    command === "EXPIRE_ASSIGNMENT_OFFER"
  ) {
    return "assignment";
  }
  if (command === "ACCEPT_CLEANER_ASSIGNMENT") return "confirmed";
  if (command === "MARK_COMPLETED" || command === "MARK_PAYOUT_READY" || command === "MARK_PAID_OUT") {
    return "completed";
  }
  if (command === "CANCEL_BOOKING") return "risk";
  if (toStatus === "payment_failed") return "payment";
  if (toStatus === "confirmed" || toStatus === "assigned") return "confirmed";
  if (toStatus === "completed" || toStatus === "payout_ready" || toStatus === "paid_out") {
    return "completed";
  }
  if (toStatus === "pending_assignment") return "assignment";
  return "assignment";
}

function titleForBookingAudit(row: BookingStateAuditRow): string {
  const display = describeBookingStateAuditDisplay(row);
  if (display.displayTitle) return display.displayTitle;

  switch (row.command) {
    case "FINALIZE_PAYMENT_SUCCESS":
    case "CONFIRM_PAYMENT":
      return "Payment confirmed";
    case "MARK_PAYMENT_FAILED":
      return "Payment attention";
    case "OFFER_TO_CLEANER":
      return "Dispatch offer sent";
    case "ACCEPT_CLEANER_ASSIGNMENT":
      return "Cleaner assigned";
    case "MOVE_TO_PENDING_ASSIGNMENT":
      return "Finding cleaner";
    case "RECORD_ASSIGNMENT_OFFER_EXPIRED":
    case "EXPIRE_ASSIGNMENT_OFFER":
      return "Offer expired";
    case "MARK_IN_PROGRESS":
      return "Visit in progress";
    case "MARK_COMPLETED":
      return "Visit completed";
    case "MARK_PAYOUT_READY":
      return "Payout ready";
    case "MARK_PAID_OUT":
      return "Paid out";
    case "CANCEL_BOOKING":
      return "Booking cancelled";
    default:
      break;
  }

  if (row.to_status) {
    return labelForBookingStatus(row.to_status as BookingStatus);
  }
  return "Booking updated";
}

function mapBookingAuditRow(row: BookingStateAuditRow): AdminOverviewOperationalEvent | null {
  if (!row.to_status && !row.command) return null;
  if (row.command && !BOOKING_AUDIT_FEED_COMMANDS.has(row.command)) return null;

  return {
    id: `booking-audit-${row.id}`,
    bookingId: row.booking_id,
    at: row.created_at,
    source: "booking_audit",
    kind: mapBookingAuditKind(row.command, row.to_status as BookingStatus | null),
    title: titleForBookingAudit(row),
    detail: null,
  };
}

function mapAdminAuditRow(row: AdminOperationalAuditRow): AdminOverviewOperationalEvent | null {
  if (!ADMIN_AUDIT_FEED_ACTIONS.has(row.action)) return null;
  if (!ADMIN_AUDIT_FEED_OUTCOMES.has(row.outcome)) return null;

  const title =
    ADMIN_OPERATIONAL_AUDIT_ACTION_LABELS[row.action] ?? row.action.replaceAll("_", " ");
  const detail = row.reason?.trim() ? row.reason.trim() : null;

  let kind: AdminOverviewOperationalEvent["kind"] = "support";
  if (row.action === "assignment_recovery" || row.action === "manual_dispatch_offer") {
    kind = "assignment";
  }
  if (row.action === "deferred_dispatch_now") kind = "risk";
  if (row.action === "replace_open_offer") kind = "assignment";

  return {
    id: `admin-audit-${row.id}`,
    bookingId: row.booking_id,
    at: row.created_at,
    source: "admin_audit",
    kind,
    title,
    detail,
  };
}

export async function loadAdminOverviewOperationalEvents(
  client: SupabaseClient,
): Promise<AdminOverviewOperationalEvent[]> {
  const [{ data: bookingAudits, error: bookingError }, { data: adminAudits, error: adminError }] =
    await Promise.all([
      client
        .from("booking_state_audit")
        .select("id, booking_id, command, to_status, from_status, created_at")
        .order("created_at", { ascending: false })
        .limit(BOOKING_AUDIT_FETCH_LIMIT),
      client
        .from("admin_operational_audit")
        .select("id, booking_id, action, outcome, created_at, reason")
        .order("created_at", { ascending: false })
        .limit(ADMIN_AUDIT_FETCH_LIMIT),
    ]);

  if (bookingError) throw new Error(bookingError.message);
  if (adminError) throw new Error(adminError.message);

  const merged: AdminOverviewOperationalEvent[] = [];

  for (const row of bookingAudits ?? []) {
    const mapped = mapBookingAuditRow(row as BookingStateAuditRow);
    if (mapped) merged.push(mapped);
  }
  for (const row of adminAudits ?? []) {
    const mapped = mapAdminAuditRow(row as AdminOperationalAuditRow);
    if (mapped) merged.push(mapped);
  }

  merged.sort((a, b) => b.at.localeCompare(a.at));

  const seen = new Set<string>();
  const deduped: AdminOverviewOperationalEvent[] = [];
  for (const event of merged) {
    const bookingKey = event.bookingId ?? "archived";
    const key = `${bookingKey}:${event.title}:${event.at.slice(0, 16)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(event);
  }

  return deduped;
}
