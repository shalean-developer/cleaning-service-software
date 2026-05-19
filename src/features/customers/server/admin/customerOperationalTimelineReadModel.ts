import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type {
  BookingStateAuditRow,
  CustomerOperationalAuditRow,
  Json,
  PaymentRow,
  PaymentStatus,
} from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { isRecurringFrequency } from "@/features/booking-wizard/recurringDisplay";
import { PRICING_FREQUENCIES, type PricingFrequency } from "@/features/pricing/server/types";
import { humanPaymentEventTitle } from "@/features/dashboards/server/lifecycleTimelinePresentation";
import { labelForBookingStatus } from "@/features/bookings/server/statusLabels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CUSTOMER_ACTIVITY_TIMELINE_LIMIT,
  type CustomerOperationalTimelineEvent,
  type CustomerOperationalTimelineResult,
  type CustomerTimelineSource,
} from "./customerOperationalTimelineTypes";

const BOOKING_FETCH_CAP = 50;
const CUSTOMER_AUDIT_FETCH_CAP = 40;

export type BookingTimelineSlice = {
  id: string;
  status: string;
  scheduled_start: string;
  series_id: string | null;
  metadata: Json;
  created_at: string;
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readBookingFrequency(metadata: Json): PricingFrequency {
  const record = asRecord(metadata);
  const raw =
    (typeof record.frequency === "string" ? record.frequency : null) ??
    (typeof record.quote === "object" &&
    record.quote !== null &&
    !Array.isArray(record.quote) &&
    typeof (record.quote as Record<string, unknown>).frequency === "string"
      ? ((record.quote as Record<string, unknown>).frequency as string)
      : null);
  if (raw && (PRICING_FREQUENCIES as readonly string[]).includes(raw)) {
    return raw as PricingFrequency;
  }
  return "once";
}

function isRecurringBooking(booking: Pick<BookingTimelineSlice, "metadata" | "series_id">): boolean {
  if (booking.series_id) return true;
  return isRecurringFrequency(readBookingFrequency(booking.metadata));
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSchedule(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function bookingHref(bookingId: string): string {
  return `/admin/bookings/${bookingId}`;
}

function mapActorSource(actorType: string | null | undefined): CustomerTimelineSource {
  const normalized = actorType?.trim().toLowerCase() ?? "";
  if (normalized === "admin") return "Admin";
  if (normalized === "customer") return "Customer";
  return "System";
}

function readChangedFields(metadata: Json): string[] {
  const record = asRecord(metadata);
  const raw = record.changed_fields;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function mapCustomerAuditEvent(row: CustomerOperationalAuditRow): CustomerOperationalTimelineEvent {
  const changed = readChangedFields(row.metadata);
  let title = "Customer record updated";
  let detail: string | null = null;

  if (row.action === "customer_created") {
    title = row.outcome === "success" ? "Customer account created" : "Customer create attempted";
    const meta = asRecord(row.metadata);
    if (meta.idempotent === true) {
      detail = "Existing customer returned (no changes applied).";
    }
  } else if (row.action === "customer_updated") {
    title = "Customer profile updated";
    if (changed.length > 0) {
      detail = `Updated ${changed.join(", ").replaceAll("_", " ")}.`;
    }
  } else {
    title = row.action.replaceAll("_", " ");
  }

  if (row.outcome !== "success" && row.reason?.trim()) {
    detail = row.reason.trim();
  }

  return {
    id: `customer-audit-${row.id}`,
    at: row.created_at,
    title,
    detail,
    source: "Admin",
    bookingId: null,
    bookingHref: null,
  };
}

function mapBookingCreatedEvent(booking: BookingTimelineSlice): CustomerOperationalTimelineEvent {
  const status = booking.status as BookingStatus;
  const recurring = isRecurringBooking(booking);
  const details: string[] = [
    labelForBookingStatus(status),
    `Scheduled ${formatSchedule(booking.scheduled_start)}`,
  ];
  if (recurring) {
    details.push(booking.series_id ? "Recurring series" : "Recurring booking");
  }

  return {
    id: `booking-created-${booking.id}`,
    at: booking.created_at,
    title: "Booking created",
    detail: details.join(" · "),
    source: "Booking",
    bookingId: booking.id,
    bookingHref: bookingHref(booking.id),
  };
}

function mapBookingAuditEvent(
  audit: BookingStateAuditRow,
  bookingId: string,
): CustomerOperationalTimelineEvent | null {
  if (!audit.to_status) return null;

  const toStatus = audit.to_status as BookingStatus;
  let title = labelForBookingStatus(toStatus);

  if (toStatus === "completed") {
    title = "Booking completed";
  } else if (toStatus === "payment_failed") {
    title = "Payment failed";
  } else if (audit.from_status && audit.from_status !== audit.to_status) {
    title = `Booking ${labelForBookingStatus(audit.from_status as BookingStatus)} → ${labelForBookingStatus(toStatus)}`;
  }

  const detailParts: string[] = [];
  if (audit.command && audit.command !== "TRANSITION") {
    detailParts.push(audit.command.replaceAll("_", " ").toLowerCase());
  }
  if (audit.reason?.trim()) {
    detailParts.push(audit.reason.trim());
  }

  return {
    id: `booking-audit-${audit.id}`,
    at: audit.created_at,
    title,
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    source: mapActorSource(audit.actor_type),
    bookingId,
    bookingHref: bookingHref(bookingId),
  };
}

function mapPaymentEvent(payment: PaymentRow): CustomerOperationalTimelineEvent {
  const status = payment.status as PaymentStatus;
  let title = humanPaymentEventTitle(status, "admin");
  if (status === "failed") {
    title = "Payment failed";
  } else if (status === "paid") {
    title = "Payment received";
  }

  const detailParts: string[] = [];
  if (payment.provider?.trim()) {
    detailParts.push(payment.provider);
  }
  if (payment.provider_ref?.trim()) {
    detailParts.push(`Ref ${payment.provider_ref}`);
  }

  return {
    id: `payment-${payment.id}`,
    at: payment.updated_at || payment.created_at,
    title,
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
    source: "Payment",
    bookingId: payment.booking_id,
    bookingHref: bookingHref(payment.booking_id),
  };
}

export function buildCustomerOperationalTimelineEvents(input: {
  customerAudits: CustomerOperationalAuditRow[];
  bookings: BookingTimelineSlice[];
  bookingAudits: BookingStateAuditRow[];
  payments: PaymentRow[];
}): CustomerOperationalTimelineEvent[] {
  const events: CustomerOperationalTimelineEvent[] = [];

  for (const row of input.customerAudits) {
    events.push(mapCustomerAuditEvent(row));
  }

  for (const booking of input.bookings) {
    events.push(mapBookingCreatedEvent(booking));
  }

  for (const audit of input.bookingAudits) {
    const mapped = mapBookingAuditEvent(audit, audit.booking_id);
    if (mapped) events.push(mapped);
  }

  for (const payment of input.payments) {
    events.push(mapPaymentEvent(payment));
  }

  return events
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, CUSTOMER_ACTIVITY_TIMELINE_LIMIT);
}

export async function getCustomerOperationalTimeline(
  user: CurrentUser,
  customerId: string,
): Promise<CustomerOperationalTimelineResult> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      status: 503,
    };
  }

  const { data: customerRow, error: customerError } = await client
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: customerError.message,
      status: 500,
    };
  }
  if (!customerRow) {
    return { ok: false, code: "CUSTOMER_NOT_FOUND", message: "Customer not found.", status: 404 };
  }

  const { data: customerAudits, error: auditError } = await client
    .from("customer_operational_audit")
    .select("id, customer_id, action, outcome, reason, metadata, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER_AUDIT_FETCH_CAP);

  if (auditError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: auditError.message,
      status: 500,
    };
  }

  const { data: bookings, error: bookingsError } = await client
    .from("bookings")
    .select("id, status, scheduled_start, series_id, metadata, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(BOOKING_FETCH_CAP);

  if (bookingsError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: bookingsError.message,
      status: 500,
    };
  }

  const bookingRows = (bookings ?? []) as BookingTimelineSlice[];
  const bookingIds = bookingRows.map((b) => b.id);

  let bookingAudits: BookingStateAuditRow[] = [];
  let payments: PaymentRow[] = [];

  if (bookingIds.length > 0) {
    const chunkSize = 40;
    for (let i = 0; i < bookingIds.length; i += chunkSize) {
      const chunk = bookingIds.slice(i, i + chunkSize);
      const [auditResult, paymentResult] = await Promise.all([
        client
          .from("booking_state_audit")
          .select(
            "id, booking_id, from_status, to_status, command, actor_type, reason, created_at",
          )
          .in("booking_id", chunk)
          .order("created_at", { ascending: false }),
        client
          .from("payments")
          .select("id, booking_id, status, provider, provider_ref, created_at, updated_at")
          .in("booking_id", chunk)
          .order("updated_at", { ascending: false }),
      ]);

      if (auditResult.error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: auditResult.error.message,
          status: 500,
        };
      }
      if (paymentResult.error) {
        return {
          ok: false,
          code: "PERSISTENCE_ERROR",
          message: paymentResult.error.message,
          status: 500,
        };
      }

      bookingAudits.push(...((auditResult.data ?? []) as BookingStateAuditRow[]));
      payments.push(...((paymentResult.data ?? []) as PaymentRow[]));
    }
  }

  const events = buildCustomerOperationalTimelineEvents({
    customerAudits: (customerAudits ?? []) as CustomerOperationalAuditRow[],
    bookings: bookingRows,
    bookingAudits,
    payments,
  });

  return { ok: true, events };
}
