import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import type {
  BookingSupportRequestRow,
  BookingSupportRequestStatus,
} from "@/lib/database/types";
import type { Database } from "@/lib/database/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { RescheduleAssignmentHandling } from "@/features/bookings/server/commands/types";
import { RESCHEDULE_ASSIGNMENT_HANDLING } from "@/features/bookings/server/commands/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  labelForBookingSupportRequestStatus,
  labelForBookingSupportRequestType,
} from "@/features/bookings/server/bookingSupportRequestTypes";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordBookingSupportRequestAudit } from "@/features/support/server/recordSupportRequestAudit";
import {
  enqueueSupportNotification,
  mapStatusToNotificationEvent,
  voidEnqueueSupportNotification,
} from "@/features/support/server/enqueueSupportNotification";
import { resolveCustomerEmailOrNull } from "@/features/notifications/server/resolveCustomerEmailOrNull";
import type { BookingSupportRequestSummary } from "@/features/bookings/server/bookingSupportRequestsService";

export type ExecuteRescheduleAssignmentOutcome = "none" | "retained" | "unassigned";

export type ExecuteApprovedRescheduleResult = {
  ok: true;
  idempotent: boolean;
  booking: {
    id: string;
    status: BookingStatus;
    scheduledStart: string;
    scheduledEnd: string;
    cleanerId: string | null;
  };
  supportRequest: BookingSupportRequestSummary;
  assignmentOutcome: ExecuteRescheduleAssignmentOutcome;
  auditIdempotencyKey: string;
};

export type ExecuteApprovedRescheduleFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

function supportExecuteIdempotencyKey(requestId: string): string {
  return `support:execute-reschedule:${requestId}`;
}

function isAssignmentHandling(value: string): value is RescheduleAssignmentHandling {
  return (RESCHEDULE_ASSIGNMENT_HANDLING as readonly string[]).includes(value);
}

function formatDefaultCustomerResponse(scheduledStart: string, scheduledEnd: string): string {
  const fmt = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const start = fmt.format(new Date(scheduledStart));
  const end = fmt.format(new Date(scheduledEnd));
  return `We've confirmed your new visit time: ${start} – ${end}.`;
}

function readExecutedRescheduleMeta(
  metadata: unknown,
): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const executed = (metadata as Record<string, unknown>).executedReschedule;
  if (!executed || typeof executed !== "object" || Array.isArray(executed)) return null;
  return executed as Record<string, unknown>;
}

function mapSupportRowToSummary(row: BookingSupportRequestRow): BookingSupportRequestSummary {
  const statusChangedAt =
    row.status === "open"
      ? row.created_at
      : row.responded_at ?? row.resolved_at ?? row.updated_at;
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
    customerResponse: row.customer_response,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    statusChangedAt,
    resolvedAt: row.resolved_at,
    staleOpen24h: false,
    staleAcknowledged48h: false,
  };
}

async function loadBookingForExecute(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<
  | {
      id: string;
      status: BookingStatus;
      series_id: string | null;
      scheduled_start: string;
      scheduled_end: string;
      cleaner_id: string | null;
      customer_id: string;
      metadata: unknown;
    }
  | null
> {
  const { data, error } = await client
    .from("bookings")
    .select(
      "id, status, series_id, scheduled_start, scheduled_end, cleaner_id, customer_id, metadata",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

function assignmentOutcomeFromBookingMetadata(
  metadata: unknown,
): ExecuteRescheduleAssignmentOutcome {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "none";
  const exec = (metadata as Record<string, unknown>).supportRescheduleExecution;
  if (!exec || typeof exec !== "object" || Array.isArray(exec)) return "none";
  const outcome = (exec as Record<string, unknown>).assignmentOutcome;
  if (outcome === "retained" || outcome === "unassigned" || outcome === "none") {
    return outcome;
  }
  return "none";
}

export async function executeApprovedBookingRescheduleRequest(
  user: CurrentUser,
  input: {
    supportRequestId: string;
    newScheduledStart: string;
    newScheduledEnd: string;
    assignmentHandling: string;
    adminNote?: string | null;
    customerResponse?: string | null;
    confirm: boolean;
  },
): Promise<ExecuteApprovedRescheduleResult | ExecuteApprovedRescheduleFailure> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admin only.", httpStatus: 403 };
  }
  if (input.confirm !== true) {
    return {
      ok: false,
      code: "CONFIRMATION_REQUIRED",
      message: "Set confirm to true to execute this reschedule.",
      httpStatus: 400,
    };
  }
  if (!isAssignmentHandling(input.assignmentHandling)) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "assignmentHandling must be keep_if_available, unassign_if_unavailable, or block_if_unavailable.",
      httpStatus: 400,
    };
  }

  const startMs = new Date(input.newScheduledStart).getTime();
  const endMs = new Date(input.newScheduledEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Invalid schedule window.",
      httpStatus: 400,
    };
  }
  if (startMs <= Date.now()) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "New visit time must be in the future.",
      httpStatus: 400,
    };
  }

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Database unavailable.",
      httpStatus: 500,
    };
  }

  const requestId = input.supportRequestId.trim();
  const { data: requestRow, error: fetchError } = await client
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
  if (!requestRow) {
    return { ok: false, code: "NOT_FOUND", message: "Request not found.", httpStatus: 404 };
  }

  const request = requestRow as BookingSupportRequestRow;
  if (request.request_type !== "reschedule") {
    return {
      ok: false,
      code: "INVALID_REQUEST_TYPE",
      message: "Only reschedule requests can be executed.",
      httpStatus: 400,
    };
  }

  const openStatuses: BookingSupportRequestStatus[] = ["open", "acknowledged"];
  const executedMeta = readExecutedRescheduleMeta(request.metadata);
  const idempotencyKey = supportExecuteIdempotencyKey(requestId);

  if (request.status === "resolved" && executedMeta) {
    const booking = await loadBookingForExecute(client, request.booking_id);
    if (!booking) {
      return {
        ok: false,
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found.",
        httpStatus: 404,
      };
    }
    const outcome =
      (executedMeta.assignmentOutcome as ExecuteRescheduleAssignmentOutcome | undefined) ??
      "none";
    const { data: freshRequest } = await client
      .from("booking_support_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    return {
      ok: true,
      idempotent: true,
      booking: {
        id: booking.id,
        status: booking.status,
        scheduledStart: booking.scheduled_start,
        scheduledEnd: booking.scheduled_end,
        cleanerId: booking.cleaner_id,
      },
      supportRequest: mapSupportRowToSummary(
        (freshRequest ?? request) as BookingSupportRequestRow,
      ),
      assignmentOutcome: outcome,
      auditIdempotencyKey: idempotencyKey,
    };
  }

  if (!openStatuses.includes(request.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "Request must be open or acknowledged before execution.",
      httpStatus: 400,
    };
  }

  const booking = await loadBookingForExecute(client, request.booking_id);
  if (!booking) {
    return {
      ok: false,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found.",
      httpStatus: 404,
    };
  }
  if (booking.series_id) {
    return {
      ok: false,
      code: "RECURRING_NOT_SUPPORTED",
      message: "Recurring visits must be handled via recurring support.",
      httpStatus: 400,
    };
  }
  if (booking.status === "completed" || booking.status === "cancelled") {
    return {
      ok: false,
      code: "TERMINAL_STATE",
      message: "Cannot reschedule a completed or cancelled booking.",
      httpStatus: 400,
    };
  }

  const backend = createBookingCommandBackend();
  const cmdResult = await executeBookingCommand(
    backend,
    {
      type: "RESCHEDULE_BOOKING",
      actor: { actorType: "admin", profileId: user.profileId },
      bookingId: booking.id,
      newScheduledStart: input.newScheduledStart,
      newScheduledEnd: input.newScheduledEnd,
      assignmentHandling: input.assignmentHandling,
      supportRequestId: requestId,
      idempotencyKey,
      reason: input.adminNote?.trim() || "Approved support reschedule",
    },
    { supabaseClient: client },
  );

  if (!cmdResult.ok) {
    const httpStatus =
      cmdResult.code === "ASSIGNMENT_UNAVAILABLE"
        ? 409
        : cmdResult.code === "FORBIDDEN"
          ? 403
          : 400;
    return {
      ok: false,
      code: cmdResult.code,
      message: cmdResult.message,
      httpStatus,
    };
  }

  const updatedBooking = await loadBookingForExecute(client, booking.id);
  if (!updatedBooking) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Booking missing after reschedule.",
      httpStatus: 500,
    };
  }

  const assignmentOutcome = assignmentOutcomeFromBookingMetadata(updatedBooking.metadata);

  const nowIso = new Date().toISOString();
  const customerResponse =
    input.customerResponse?.trim() ||
    formatDefaultCustomerResponse(input.newScheduledStart, input.newScheduledEnd);

  const requestMeta =
    request.metadata && typeof request.metadata === "object" && !Array.isArray(request.metadata)
      ? (request.metadata as Record<string, unknown>)
      : {};
  const executionRecord = {
    executedAt: nowIso,
    executedByProfileId: user.profileId,
    previousScheduledStart: booking.scheduled_start,
    previousScheduledEnd: booking.scheduled_end,
    newScheduledStart: input.newScheduledStart,
    newScheduledEnd: input.newScheduledEnd,
    assignmentOutcome,
    bookingStateAuditIdempotencyKey: idempotencyKey,
  };

  const patch: Record<string, unknown> = {
    status: "resolved",
    resolved_at: nowIso,
    resolved_by: user.profileId,
    customer_response: customerResponse,
    responded_at: nowIso,
    metadata: {
      ...requestMeta,
      executedReschedule: executionRecord,
    },
  };
  if (input.adminNote !== undefined) {
    patch.admin_notes = input.adminNote?.trim() || null;
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

  try {
    await recordBookingSupportRequestAudit(client, {
      bookingId: request.booking_id,
      requestId,
      source: "booking_support",
      oldStatus: request.status,
      newStatus: "resolved",
      actorProfileId: user.profileId,
      requestType: request.request_type,
    });
  } catch (auditErr) {
    console.warn(
      JSON.stringify({
        event: "support_request_audit_failed",
        requestId,
        message: auditErr instanceof Error ? auditErr.message : String(auditErr),
      }),
    );
  }

  const { data: resolvedRow } = await client
    .from("booking_support_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  const notifyEvent = mapStatusToNotificationEvent("resolved");
  if (notifyEvent && resolvedRow) {
    voidEnqueueSupportNotification(
      enqueueSupportNotification(client, {
        event: notifyEvent,
        source: "booking_support",
        request: resolvedRow as BookingSupportRequestRow,
        statusChangedAt: nowIso,
        recipientEmail: await resolveCustomerEmailOrNull(request.customer_id),
      }),
    );
  }

  return {
    ok: true,
    idempotent: cmdResult.idempotent,
    booking: {
      id: updatedBooking.id,
      status: updatedBooking.status,
      scheduledStart: updatedBooking.scheduled_start,
      scheduledEnd: updatedBooking.scheduled_end,
      cleanerId: updatedBooking.cleaner_id,
    },
    supportRequest: mapSupportRowToSummary(
      (resolvedRow ?? request) as BookingSupportRequestRow,
    ),
    assignmentOutcome,
    auditIdempotencyKey: idempotencyKey,
  };
}
