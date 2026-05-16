import "server-only";

import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandResult } from "@/features/bookings/server/commands/types";
import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";

async function cleanerContext(user: CurrentUser) {
  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false as const,
      status: 503,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
    };
  }
  const scope = await resolveActorScope(client, user.profileId, user.role);
  if (!scope.actingCleanerId) {
    return {
      ok: false as const,
      status: 403,
      code: "FORBIDDEN",
      message: "Cleaner profile not linked.",
    };
  }
  return { ok: true as const, scope };
}

export async function startCleanerJob(
  user: CurrentUser,
  bookingId: string,
): Promise<BookingCommandResult & { httpStatus?: number }> {
  if (user.role !== "cleaner") {
    return { ok: false, code: "FORBIDDEN", message: "Cleaners only.", httpStatus: 403 };
  }
  const ctxResult = await cleanerContext(user);
  if (!ctxResult.ok) {
    return {
      ok: false,
      code: ctxResult.code as "FORBIDDEN",
      message: ctxResult.message,
      httpStatus: ctxResult.status,
    };
  }

  const backend = createBookingCommandBackend();
  const result = await executeBookingCommand(
    backend,
    {
      type: "MARK_BOOKING_IN_PROGRESS",
      actor: { actorType: "cleaner", profileId: user.profileId },
      bookingId,
    },
    { actingCleanerId: ctxResult.scope.actingCleanerId },
  );
  return {
    ...result,
    httpStatus: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : 400,
  };
}

export async function completeCleanerJob(
  user: CurrentUser,
  bookingId: string,
  idempotencyKey?: string | null,
): Promise<BookingCommandResult & { httpStatus?: number }> {
  if (user.role !== "cleaner") {
    return { ok: false, code: "FORBIDDEN", message: "Cleaners only.", httpStatus: 403 };
  }
  const ctxResult = await cleanerContext(user);
  if (!ctxResult.ok) {
    return {
      ok: false,
      code: ctxResult.code as "FORBIDDEN",
      message: ctxResult.message,
      httpStatus: ctxResult.status,
    };
  }

  const backend = createBookingCommandBackend();
  const result = await executeBookingCommand(
    backend,
    {
      type: "MARK_BOOKING_COMPLETED",
      actor: { actorType: "cleaner", profileId: user.profileId },
      bookingId,
      idempotencyKey: idempotencyKey ?? `complete-${bookingId}`,
    },
    { actingCleanerId: ctxResult.scope.actingCleanerId },
  );
  return {
    ...result,
    httpStatus: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : 400,
  };
}

export async function markBookingPayoutReadyAdmin(
  user: CurrentUser,
  bookingId: string,
): Promise<BookingCommandResult & { httpStatus?: number }> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", httpStatus: 403 };
  }

  const backend = createBookingCommandBackend();
  const result = await executeBookingCommand(backend, {
    type: "MARK_BOOKING_PAYOUT_READY",
    actor: { actorType: "admin", profileId: user.profileId },
    bookingId,
    idempotencyKey: `payout-ready-${bookingId}`,
  });
  return {
    ...result,
    httpStatus: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : 400,
  };
}

export async function markBookingPaidOutAdmin(
  user: CurrentUser,
  bookingId: string,
  payoutBatchId?: string | null,
): Promise<BookingCommandResult & { httpStatus?: number }> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", httpStatus: 403 };
  }

  const backend = createBookingCommandBackend();
  const result = await executeBookingCommand(backend, {
    type: "MARK_BOOKING_PAID_OUT",
    actor: { actorType: "admin", profileId: user.profileId },
    bookingId,
    payoutBatchId: payoutBatchId ?? null,
    idempotencyKey: `paid-out-${bookingId}`,
  });
  return {
    ...result,
    httpStatus: result.ok ? 200 : result.code === "FORBIDDEN" ? 403 : 400,
  };
}
