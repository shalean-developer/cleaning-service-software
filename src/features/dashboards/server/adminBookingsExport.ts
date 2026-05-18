import type { AdminBookingListItem } from "./types";
import {
  labelForAssignmentAttention,
  labelForAssignmentVisibilityKey,
  labelForBookingStatus,
  labelForPaymentStatus,
} from "@/features/bookings/server/statusLabels";
import { labelForAdminPaymentFailureAttention } from "@/features/bookings/server/paymentFailureDisplay";

export const ADMIN_BOOKINGS_EXPORT_LIMIT = 500;

export const ADMIN_BOOKINGS_CSV_HEADERS = [
  "booking_id",
  "booking_reference",
  "status",
  "status_label",
  "payment_status_label",
  "payment_failure_category",
  "assignment_status_key",
  "assignment_status_label",
  "service_name",
  "scheduled_start",
  "scheduled_end",
  "customer_name",
  "cleaner_name",
  "suburb",
  "city",
  "total_amount",
  "created_at",
  "updated_at",
  "provider_ref",
  "two_cleaner_request",
  "operational_load_score",
  "team_fulfillment",
  "supporting_cleaner",
  "coordination_status",
  "team_ops_notes_present",
] as const;

export type AdminBookingCsvRow = Record<(typeof ADMIN_BOOKINGS_CSV_HEADERS)[number], string>;

const FORBIDDEN_CSV_SUBSTRINGS = [
  "metadata",
  "authorization",
  "webhook",
  "password",
  "Bearer ",
  "@",
] as const;

/** RFC 4180 field escape with formula-injection hardening. */
export function escapeCsvCell(value: string): string {
  let safe = value;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function formatCsvRow(values: readonly string[]): string {
  return values.map((v) => escapeCsvCell(v)).join(",");
}

export function buildBookingsExportFilename(scope: string, exportedAt: Date = new Date()): string {
  const ts = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const safeScope = scope.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "all";
  return `bookings-export-${safeScope}-${ts}.csv`;
}

export function resolveBookingsExportScope(filter: string | undefined): string {
  return filter?.trim() ? filter.replace(/_/g, "-") : "all";
}

export function mapAdminBookingListItemToCsvRow(item: AdminBookingListItem): AdminBookingCsvRow {
  const assignmentKey = item.assignmentVisibilityKey ?? "";
  const assignmentLabel =
    labelForAssignmentVisibilityKey(item.assignmentVisibilityKey) ??
    labelForAssignmentAttention(
      item.assignmentVisibilityKey ?? item.assignmentAttention,
      null,
    );

  return {
    booking_id: item.id,
    booking_reference: item.id.slice(0, 8),
    status: item.status,
    status_label: labelForBookingStatus(item.status),
    payment_status_label: labelForPaymentStatus(item.paymentStatus),
    payment_failure_category:
      item.status === "payment_failed"
        ? labelForAdminPaymentFailureAttention(item.paymentFailureReason)
        : "",
    assignment_status_key: assignmentKey,
    assignment_status_label: assignmentLabel === "—" ? "" : assignmentLabel,
    service_name: item.serviceLabel,
    scheduled_start: item.scheduledStart ?? "",
    scheduled_end: item.scheduledEnd ?? "",
    customer_name: item.customerLabel,
    cleaner_name: item.cleanerLabel ?? "",
    suburb: item.suburb ?? "",
    city: item.city ?? "",
    total_amount: item.priceLabel,
    created_at: item.createdAt ?? "",
    updated_at: item.updatedAt,
    provider_ref: item.latestProviderRef ?? "",
    two_cleaner_request: item.observation.isTwoCleanerRequest ? "yes" : "no",
    operational_load_score: String(item.observation.operationalLoad.operationalLoadScore),
    team_fulfillment: item.observation.teamRequestFulfillmentLabel ?? "",
    supporting_cleaner: item.observation.supportingCleanerLabel ?? "",
    coordination_status: item.observation.coordinationStatusLabel ?? "",
    team_ops_notes_present: item.observation.hasTeamSupportNotes ? "yes" : "no",
  };
}

export function renderAdminBookingsCsv(
  rows: AdminBookingCsvRow[],
  meta?: { truncated: boolean; returnedCount: number; matchTotal: number | null },
): string {
  const lines: string[] = [];
  if (meta?.truncated && meta.matchTotal !== null) {
    lines.push(
      `# Exported ${meta.returnedCount} of ${meta.matchTotal} matching bookings (cap ${ADMIN_BOOKINGS_EXPORT_LIMIT}).`,
    );
  }
  lines.push(ADMIN_BOOKINGS_CSV_HEADERS.join(","));
  for (const row of rows) {
    lines.push(formatCsvRow(ADMIN_BOOKINGS_CSV_HEADERS.map((h) => row[h])));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** Test helper — assert exported CSV does not leak forbidden patterns. */
export function assertCsvExcludesSensitivePatterns(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (forbidden === "@") continue;
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`CSV contains forbidden pattern: ${forbidden}`);
    }
  }
  if (/@\w+\.\w+/.test(csv)) {
    throw new Error("CSV appears to contain an email address");
  }
}
