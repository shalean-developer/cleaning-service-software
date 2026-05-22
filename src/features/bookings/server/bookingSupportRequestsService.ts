import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { customerProvisioningApiFailure } from "@/lib/auth/customerReadiness";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import type {
  BookingSupportRequestRow,
  BookingSupportRequestStatus,
  BookingSupportRequestType,
  PaymentStatus,
} from "@/lib/database/types";
import type { Database } from "@/lib/database/types";
import { BOOKING_SUPPORT_REQUEST_TYPES } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  isBookingSupportRequestTypeAllowed,
  labelForBookingSupportRequestStatus,
  labelForBookingSupportRequestType,
  type BookingSupportActionContext,
} from "./bookingSupportRequestTypes";
import {
  buildBookingSupportNotificationPayload,
  BOOKING_SUPPORT_NOTIFICATIONS_ENABLED,
} from "./bookingSupportRequestNotifications";

export type BookingSupportRequestSummary = {
  id: string;
  bookingId: string;
  customerId: string;
  requestType: BookingSupportRequestType;
  requestTypeLabel: string;
  status: BookingSupportRequestStatus;
  statusLabel: string;
  message: string | null;
  preferredNewTime: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

function mapRow(row: BookingSupportRequestRow): BookingSupportRequestSummary {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    requestType: row.request_type,
    requestTypeLabel: labelForBookingSupportRequestType(row.request_type),
    status: row.status,
    statusLabel: labelForBookingSupportRequestStatus(row.status),
    message: row.message,
    preferredNewTime: row.preferred_new_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
  };
}

function isValidRequestType(value: string): value is BookingSupportRequestType {
  return (BOOKING_SUPPORT_REQUEST_TYPES as readonly string[]).includes(value);
}

async function loadBookingForCustomer(
  client: SupabaseClient<Database>,
  bookingId: string,
  actingCustomerId: string,
): Promise<
  | {
      ok: true;
      row: {
        id: string;
        customer_id: string;
        status: BookingStatus;
        series_id: string | null;
        cleaner_id: string | null;
      };
      paymentStatus: PaymentStatus | null;
    }
  | { ok: false; code: string; message: string; httpStatus: number }
> {
  const { data: row, error } = await client
    .from("bookings")
    .select("id, customer_id, status, series_id, cleaner_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: error.message,
      httpStatus: 500,
    };
  }
  if (!row || row.customer_id !== actingCustomerId) {
    return { ok: false, code: "NOT_FOUND", message: "Booking not found.", httpStatus: 404 };
  }

  const { data: payments } = await client
    .from("payments")
    .select("status, updated_at")
    .eq("booking_id", bookingId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const paymentStatus = (payments?.[0]?.status as PaymentStatus | undefined) ?? null;

  return {
    ok: true,
    row: {
      id: row.id,
      customer_id: row.customer_id,
      status: row.status as BookingStatus,
      series_id: row.series_id ?? null,
      cleaner_id: row.cleaner_id,
    },
    paymentStatus,
  };
}

function buildActionContext(
  row: { status: BookingStatus; series_id: string | null; cleaner_id: string | null },
  paymentStatus: PaymentStatus | null,
  assignedCleanerLabel: string | null,
): BookingSupportActionContext {
  return {
    status: row.status,
    paymentStatus,
    isSeriesVisit: Boolean(row.series_id),
    hasAssignedCleaner: Boolean(row.cleaner_id?.trim() || assignedCleanerLabel?.trim()),
  };
}

export async function listBookingSupportRequestsForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingSupportRequestSummary[]> {
  const { data, error } = await client
    .from("booking_support_requests")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as BookingSupportRequestRow[]).map(mapRow);
}

export async function listCustomerBookingSupportRequests(
  user: CurrentUser,
  bookingId: string,
): Promise<
  | { ok: true; requests: BookingSupportRequestSummary[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "customer") {
    return { ok: false, code: "FORBIDDEN", message: "Customers only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCustomerId) {
    return customerProvisioningApiFailure();
  }

  const booking = await loadBookingForCustomer(client, bookingId, ctx.actingCustomerId);
  if (!booking.ok) {
    return {
      ok: false,
      code: booking.code,
      message: booking.message,
      status: booking.httpStatus,
    };
  }

  const requests = await listBookingSupportRequestsForBooking(client, bookingId);
  return { ok: true, requests };
}

export async function customerCreateBookingSupportRequest(
  user: CurrentUser,
  bookingId: string,
  input: {
    requestType: string;
    message?: string | null;
    preferredNewTime?: string | null;
    confirmCancel?: boolean;
  },
): Promise<
  | { ok: true; message: string; requestId: string }
  | { ok: false; code: string; message: string; httpStatus: number }
> {
  if (user.role !== "customer") {
    return { ok: false, code: "FORBIDDEN", message: "Customers only.", httpStatus: 403 };
  }

  if (!isValidRequestType(input.requestType)) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid request type.",
      httpStatus: 400,
    };
  }

  const requestType = input.requestType;

  if (requestType === "cancel" && input.confirmCancel !== true) {
    return {
      ok: false,
      code: "CONFIRMATION_REQUIRED",
      message: "Confirm cancellation request before submitting.",
      httpStatus: 400,
    };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      httpStatus: 500,
    };
  }

  const scope = await resolveActorScope(client, user.profileId, user.role);
  if (!scope.actingCustomerId) {
    return {
      ok: false,
      code: "CUSTOMER_NOT_READY",
      message: "Complete account setup before submitting requests.",
      httpStatus: 403,
    };
  }

  const booking = await loadBookingForCustomer(client, bookingId, scope.actingCustomerId);
  if (!booking.ok) {
    return {
      ok: false,
      code: booking.code,
      message: booking.message,
      httpStatus: booking.httpStatus,
    };
  }

  const actionCtx = buildActionContext(booking.row, booking.paymentStatus, null);
  if (!isBookingSupportRequestTypeAllowed(actionCtx, requestType)) {
    return {
      ok: false,
      code: "REQUEST_NOT_ALLOWED",
      message: "This request type is not available for this booking.",
      httpStatus: 400,
    };
  }

  if (requestType === "reschedule" && !input.preferredNewTime?.trim()) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Preferred date and time is required for reschedule requests.",
      httpStatus: 400,
    };
  }

  const trimmedMessage = typeof input.message === "string" ? input.message.trim() : "";
  if (requestType !== "cancel" && trimmedMessage.length < 3) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Please add a short message (at least 3 characters).",
      httpStatus: 400,
    };
  }

  const metadata: Record<string, unknown> = {};
  if (requestType === "cancel") {
    metadata.cancellationConfirmed = true;
  }

  const { data: inserted, error } = await client
    .from("booking_support_requests")
    .insert({
      booking_id: bookingId,
      customer_id: scope.actingCustomerId,
      user_id: user.profileId,
      request_type: requestType,
      message: trimmedMessage || null,
      preferred_new_time:
        requestType === "reschedule" ? input.preferredNewTime!.trim() : null,
      metadata,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: error?.message ?? "Could not save request.",
      httpStatus: 500,
    };
  }

  if (BOOKING_SUPPORT_NOTIFICATIONS_ENABLED) {
    void buildBookingSupportNotificationPayload("booking_support_request_created", {
      requestId: inserted.id,
      bookingId,
      requestType,
    });
  }

  return {
    ok: true,
    requestId: inserted.id,
    message: "Support request submitted. Our team will review it and follow up.",
  };
}

export async function adminUpdateBookingSupportRequestStatus(
  user: CurrentUser,
  requestId: string,
  nextStatus: BookingSupportRequestStatus,
): Promise<
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; httpStatus: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admin only.", httpStatus: 403 };
  }

  if (nextStatus === "open") {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Cannot revert to open.",
      httpStatus: 400,
    };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      httpStatus: 500,
    };
  }

  const { data: row, error: fetchError } = await client
    .from("booking_support_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: fetchError.message,
      httpStatus: 500,
    };
  }
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "Request not found.", httpStatus: 404 };
  }

  const current = row as BookingSupportRequestRow;
  if (current.status === nextStatus) {
    return { ok: true, message: `Request already ${labelForBookingSupportRequestStatus(nextStatus).toLowerCase()}.` };
  }

  const patch: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "resolved" || nextStatus === "rejected") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = user.profileId;
  }

  const { error: updateError } = await client
    .from("booking_support_requests")
    .update(patch)
    .eq("id", requestId);

  if (updateError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      httpStatus: 500,
    };
  }

  if (BOOKING_SUPPORT_NOTIFICATIONS_ENABLED) {
    const event =
      nextStatus === "acknowledged"
        ? "booking_support_request_acknowledged"
        : "booking_support_request_resolved";
    void buildBookingSupportNotificationPayload(event, {
      requestId,
      bookingId: current.booking_id,
      requestType: current.request_type,
    });
  }

  const label = labelForBookingSupportRequestStatus(nextStatus);
  return { ok: true, message: `Request marked ${label.toLowerCase()}.` };
}
