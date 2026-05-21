import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { SupabaseBookingCommandBackend } from "@/features/bookings/server/commands/supabaseBookingCommandBackend";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findSeriesById, findBookingOccurrenceAt } from "../bookingSeriesRepository";
import {
  cancelEntireBookingSeries,
  cancelRecurringOccurrence,
  pauseBookingSeries,
  resumeBookingSeries,
  rescheduleSeriesNextOccurrence,
  skipNextRecurringOccurrence,
} from "../seriesActions";
import { recordRecurringSeriesAudit } from "./recordRecurringSeriesAudit";
import { generateRecurringOccurrencesForSeries } from "../generateRecurringOccurrences";

export type RecurringCommandResult =
  | { ok: true; message: string; idempotent?: boolean }
  | { ok: false; code: string; message: string; httpStatus: number };

async function loadSeriesForAdmin(seriesId: string) {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: "Database unavailable.",
        httpStatus: 500,
      } satisfies RecurringCommandResult,
    };
  }
  const series = await findSeriesById(client, seriesId);
  if (!series) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "NOT_FOUND",
        message: "Series not found.",
        httpStatus: 404,
      } satisfies RecurringCommandResult,
    };
  }
  return { ok: true as const, client, series };
}

async function loadSeriesForCustomer(user: CurrentUser, seriesId: string) {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "PERSISTENCE_ERROR",
        message: "Database unavailable.",
        httpStatus: 500,
      } satisfies RecurringCommandResult,
    };
  }
  const { resolveActorScope } = await import("@/lib/auth/resolveActorScope");
  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCustomerId) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "FORBIDDEN",
        message: "Customer profile not ready.",
        httpStatus: 403,
      } satisfies RecurringCommandResult,
    };
  }
  const series = await findSeriesById(client, seriesId);
  if (!series) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "NOT_FOUND",
        message: "Series not found.",
        httpStatus: 404,
      } satisfies RecurringCommandResult,
    };
  }
  if (series.customer_id !== ctx.actingCustomerId) {
    return {
      ok: false as const,
      result: {
        ok: false,
        code: "FORBIDDEN",
        message: "Not your series.",
        httpStatus: 403,
      } satisfies RecurringCommandResult,
    };
  }
  return { ok: true as const, client, series };
}

export async function adminPauseRecurringSeries(
  user: CurrentUser,
  seriesId: string,
  reason?: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadSeriesForAdmin(seriesId);
  if (!loaded.ok) return loaded.result;
  const { client, series } = loaded;
  if (series.status !== "active") {
    return { ok: false, code: "INVALID_STATE", message: "Series is not active.", httpStatus: 409 };
  }
  await pauseBookingSeries(client, seriesId);
  await recordRecurringSeriesAudit(client, {
    anchorBookingId: series.created_from_booking_id,
    action: "RECURRING_SERIES_PAUSE",
    seriesId,
    actorType: "admin",
    actorProfileId: user.profileId,
    reason: reason ?? null,
  });
  return { ok: true, message: "Series paused." };
}

export async function adminResumeRecurringSeries(
  user: CurrentUser,
  seriesId: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadSeriesForAdmin(seriesId);
  if (!loaded.ok) return loaded.result;
  const { client, series } = loaded;
  if (series.status !== "paused") {
    return { ok: false, code: "INVALID_STATE", message: "Series is not paused.", httpStatus: 409 };
  }
  await resumeBookingSeries(client, seriesId);
  await recordRecurringSeriesAudit(client, {
    anchorBookingId: series.created_from_booking_id,
    action: "RECURRING_SERIES_RESUME",
    seriesId,
    actorType: "admin",
    actorProfileId: user.profileId,
  });
  const backend = new SupabaseBookingCommandBackend(client);
  await generateRecurringOccurrencesForSeries(client, backend, seriesId);
  return { ok: true, message: "Series resumed." };
}

export async function adminCancelRecurringSeries(
  user: CurrentUser,
  seriesId: string,
  reason?: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadSeriesForAdmin(seriesId);
  if (!loaded.ok) return loaded.result;
  const { client, series } = loaded;
  if (series.status === "cancelled") {
    return { ok: true, message: "Series already cancelled.", idempotent: true };
  }
  const backend = new SupabaseBookingCommandBackend(client);
  const { cancelledBookings } = await cancelEntireBookingSeries(client, backend, seriesId, {
    actorType: "admin",
    profileId: user.profileId,
  });
  await recordRecurringSeriesAudit(client, {
    anchorBookingId: series.created_from_booking_id,
    action: "RECURRING_SERIES_CANCEL",
    seriesId,
    actorType: "admin",
    actorProfileId: user.profileId,
    reason: reason ?? null,
    metadata: { cancelledBookings },
  });
  return { ok: true, message: `Series cancelled. ${cancelledBookings} unpaid visit(s) removed.` };
}

export async function adminSkipNextRecurringOccurrence(
  user: CurrentUser,
  seriesId: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadSeriesForAdmin(seriesId);
  if (!loaded.ok) return loaded.result;
  const { client, series } = loaded;
  const backend = new SupabaseBookingCommandBackend(client);
  try {
    const { skippedBookingId, nextOccurrenceAt } = await skipNextRecurringOccurrence(
      client,
      backend,
      seriesId,
      { actorType: "admin", profileId: user.profileId },
    );
    await recordRecurringSeriesAudit(client, {
      anchorBookingId: series.created_from_booking_id,
      action: "RECURRING_SERIES_SKIP_NEXT",
      seriesId,
      actorType: "admin",
      actorProfileId: user.profileId,
      metadata: { skippedBookingId, nextOccurrenceAt },
    });
    return { ok: true, message: "Next occurrence skipped." };
  } catch (e) {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: e instanceof Error ? e.message : "Could not skip occurrence.",
      httpStatus: 409,
    };
  }
}

export async function adminRescheduleNextRecurringOccurrence(
  user: CurrentUser,
  seriesId: string,
  nextScheduledStartIso: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadSeriesForAdmin(seriesId);
  if (!loaded.ok) return loaded.result;
  const { client, series } = loaded;
  if (series.status !== "active") {
    return { ok: false, code: "INVALID_STATE", message: "Series is not active.", httpStatus: 409 };
  }

  const oldNext = series.next_occurrence_at;
  if (oldNext) {
    const existing = await findBookingOccurrenceAt(client, seriesId, oldNext);
    if (existing) {
      const backend = new SupabaseBookingCommandBackend(client);
      const { data: booking } = await client
        .from("bookings")
        .select("status")
        .eq("id", existing.id)
        .single();
      const unpaid = ["pending_payment", "draft", "payment_failed"];
      if (booking && unpaid.includes(booking.status as string)) {
        await cancelRecurringOccurrence(backend, existing.id, {
          actorType: "admin",
          profileId: user.profileId,
        });
      }
    }
  }

  const duplicate = await findBookingOccurrenceAt(client, seriesId, nextScheduledStartIso);
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_SLOT",
      message: "A booking already exists at that time for this series.",
      httpStatus: 409,
    };
  }

  await rescheduleSeriesNextOccurrence(client, seriesId, nextScheduledStartIso);
  await recordRecurringSeriesAudit(client, {
    anchorBookingId: series.created_from_booking_id,
    action: "RECURRING_SERIES_RESCHEDULE_NEXT",
    seriesId,
    actorType: "admin",
    actorProfileId: user.profileId,
    metadata: { oldNext, nextScheduledStartIso },
  });

  const backend = new SupabaseBookingCommandBackend(client);
  await generateRecurringOccurrencesForSeries(client, backend, seriesId);

  return { ok: true, message: "Next occurrence rescheduled." };
}

export type CustomerRecurringRequestType = "pause" | "cancel" | "reschedule";

export async function customerRequestRecurringSeriesChange(
  user: CurrentUser,
  seriesId: string,
  requestType: CustomerRecurringRequestType,
  note?: string,
): Promise<RecurringCommandResult> {
  const loaded = await loadSeriesForCustomer(user, seriesId);
  if (!loaded.ok) return loaded.result;
  const { client, series } = loaded;

  await recordRecurringSeriesAudit(client, {
    anchorBookingId: series.created_from_booking_id,
    action: "RECURRING_CUSTOMER_REQUEST",
    seriesId,
    actorType: "customer",
    actorProfileId: user.profileId,
    reason: note?.trim() || null,
    metadata: { requestType },
  });

  return {
    ok: true,
    message:
      "Request received. Our team will confirm changes to your recurring schedule shortly.",
  };
}
