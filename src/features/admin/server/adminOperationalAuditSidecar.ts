import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { RunAssignmentResult } from "@/features/assignments/server/types";
import {
  logAdminAssignmentRecovery,
  type AdminRecoveryResultStatus,
} from "@/features/assignments/server/adminAssignmentRecovery";
import {
  logAdminManualDispatch,
  type AdminManualDispatchResultStatus,
} from "@/features/assignments/server/adminManualDispatchOffer";
import {
  logAdminReplaceOpenOffer,
  type AdminReplaceOpenOfferResultStatus,
} from "@/features/assignments/server/adminReplaceOpenOffer";
import {
  logAdminDeferredDispatchNow,
  type AdminDeferredDispatchResultStatus,
} from "@/features/assignments/server/adminDeferredDispatchNow";
import {
  adminDeferredDispatchNowIdempotencyKey,
  adminDispatchIdempotencyKey,
  adminRecoveryIdempotencyKey,
  adminReplaceIdempotencyKey,
  mapAdminOperationalOutcome,
} from "./mapAdminOperationalOutcome";
import { recordAdminOperationalAudit } from "./recordAdminOperationalAudit";

type RecoveryAuditPayload = {
  bookingId: string;
  adminProfileId: string;
  reason: string;
  eligible: boolean;
  resultStatus: AdminRecoveryResultStatus;
  bookingStatusBefore?: string | null;
  bookingStatusAfter: string | null;
  engine?: RunAssignmentResult | null;
  resultCode?: string | null;
  cleanerId?: string | null;
  offerId?: string | null;
  idempotent?: boolean;
};

export async function auditAdminAssignmentRecovery(
  client: SupabaseClient<Database> | null,
  payload: RecoveryAuditPayload,
): Promise<void> {
  logAdminAssignmentRecovery({
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    reason: payload.reason,
    eligible: payload.eligible,
    resultStatus: payload.resultStatus,
    bookingStatusAfter: payload.bookingStatusAfter,
    engine: payload.engine,
  });

  const engineOk = payload.engine?.ok === true ? payload.engine : null;

  const outcome = mapAdminOperationalOutcome(payload.resultStatus, {
    idempotent: payload.idempotent ?? engineOk?.idempotent,
  });

  await recordAdminOperationalAudit(client, {
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    action: "assignment_recovery",
    outcome,
    reason: payload.reason,
    resultCode: payload.resultCode ?? null,
    cleanerId: payload.cleanerId ?? engineOk?.cleanerId ?? null,
    offerId: payload.offerId ?? engineOk?.offerId ?? null,
    idempotencyKey:
      outcome === "success" || outcome === "idempotent"
        ? adminRecoveryIdempotencyKey(payload.bookingId)
        : null,
    bookingStatusBefore: payload.bookingStatusBefore ?? null,
    bookingStatusAfter: payload.bookingStatusAfter,
    metadata: {
      eligible: payload.eligible,
      engine_outcome: engineOk?.outcome,
      engine_idempotent: engineOk?.idempotent,
      result_status: payload.resultStatus,
    },
  });
}

type DispatchAuditPayload = {
  bookingId: string;
  adminProfileId: string;
  cleanerId: string;
  reason: string;
  resultStatus: AdminManualDispatchResultStatus | "not_eligible" | "error";
  bookingStatusBefore?: string | null;
  bookingStatusAfter?: string | null;
  offerId?: string | null;
  idempotent?: boolean;
  code?: string | null;
  openOfferCount?: number;
  dispatchOfferCount?: number;
};

export async function auditAdminManualDispatch(
  client: SupabaseClient<Database> | null,
  payload: DispatchAuditPayload,
): Promise<void> {
  logAdminManualDispatch({
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    cleanerId: payload.cleanerId,
    reason: payload.reason,
    resultStatus: payload.resultStatus,
    offerId: payload.offerId,
    idempotent: payload.idempotent,
    code: payload.code ?? undefined,
  });

  const outcome = mapAdminOperationalOutcome(payload.resultStatus, {
    idempotent: payload.idempotent,
  });

  await recordAdminOperationalAudit(client, {
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    action: "manual_dispatch_offer",
    outcome,
    reason: payload.reason,
    resultCode: payload.code ?? null,
    cleanerId: payload.cleanerId,
    offerId: payload.offerId ?? null,
    idempotencyKey:
      outcome === "success" || outcome === "idempotent"
        ? adminDispatchIdempotencyKey(payload.bookingId, payload.cleanerId)
        : null,
    bookingStatusBefore: payload.bookingStatusBefore ?? null,
    bookingStatusAfter: payload.bookingStatusAfter ?? null,
    metadata: {
      result_status: payload.resultStatus,
      open_offer_count: payload.openOfferCount,
      dispatch_offer_count: payload.dispatchOfferCount,
    },
  });
}

type ReplaceAuditPayload = {
  bookingId: string;
  adminProfileId: string;
  cancelledOfferId: string | null;
  cancelledCleanerId: string | null;
  targetCleanerId: string;
  reason: string;
  resultStatus: AdminReplaceOpenOfferResultStatus | "not_eligible" | "error";
  bookingStatusBefore?: string | null;
  bookingStatusAfter?: string | null;
  offerId?: string | null;
  idempotent?: boolean;
  code?: string | null;
};

export async function auditAdminReplaceOpenOffer(
  client: SupabaseClient<Database> | null,
  payload: ReplaceAuditPayload,
): Promise<void> {
  logAdminReplaceOpenOffer({
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    cancelledOfferId: payload.cancelledOfferId,
    cancelledCleanerId: payload.cancelledCleanerId,
    targetCleanerId: payload.targetCleanerId,
    reason: payload.reason,
    resultStatus: payload.resultStatus,
    offerId: payload.offerId,
    idempotent: payload.idempotent,
    code: payload.code ?? undefined,
  });

  const outcome = mapAdminOperationalOutcome(payload.resultStatus, {
    idempotent: payload.idempotent,
  });

  const cancelledId = payload.cancelledOfferId?.trim() ? payload.cancelledOfferId : null;

  await recordAdminOperationalAudit(client, {
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    action: "replace_open_offer",
    outcome,
    reason: payload.reason,
    resultCode: payload.code ?? null,
    cleanerId: payload.targetCleanerId,
    offerId: payload.offerId ?? null,
    cancelledOfferId: cancelledId,
    idempotencyKey:
      outcome === "success" || outcome === "idempotent"
        ? cancelledId
          ? adminReplaceIdempotencyKey(payload.bookingId, cancelledId, payload.targetCleanerId)
          : adminDispatchIdempotencyKey(payload.bookingId, payload.targetCleanerId)
        : null,
    bookingStatusBefore: payload.bookingStatusBefore ?? null,
    bookingStatusAfter: payload.bookingStatusAfter ?? null,
    metadata: {
      result_status: payload.resultStatus,
      cancelled_cleaner_id: payload.cancelledCleanerId,
      target_cleaner_id: payload.targetCleanerId,
    },
  });
}

type DeferredDispatchNowAuditPayload = {
  bookingId: string;
  adminProfileId: string;
  reason: string;
  eligible: boolean;
  resultStatus: AdminDeferredDispatchResultStatus;
  bookingStatusBefore?: string | null;
  bookingStatusAfter: string | null;
  engine?: RunAssignmentResult | null;
  resultCode?: string | null;
  idempotent?: boolean;
};

export async function auditAdminDeferredDispatchNow(
  client: SupabaseClient<Database> | null,
  payload: DeferredDispatchNowAuditPayload,
): Promise<void> {
  logAdminDeferredDispatchNow({
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    reason: payload.reason,
    eligible: payload.eligible,
    resultStatus: payload.resultStatus,
    bookingStatusAfter: payload.bookingStatusAfter,
    engine: payload.engine,
  });

  const engineOk = payload.engine?.ok === true ? payload.engine : null;
  const outcome = mapAdminOperationalOutcome(payload.resultStatus, {
    idempotent: payload.idempotent ?? engineOk?.idempotent,
  });

  await recordAdminOperationalAudit(client, {
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    action: "deferred_dispatch_now",
    outcome,
    reason: payload.reason,
    resultCode: payload.resultCode ?? null,
    cleanerId: engineOk?.cleanerId ?? null,
    offerId: engineOk?.offerId ?? null,
    idempotencyKey:
      outcome === "success" || outcome === "idempotent"
        ? adminDeferredDispatchNowIdempotencyKey(payload.bookingId)
        : null,
    bookingStatusBefore: payload.bookingStatusBefore ?? null,
    bookingStatusAfter: payload.bookingStatusAfter,
    metadata: {
      eligible: payload.eligible,
      engine_outcome: engineOk?.outcome,
      engine_idempotent: engineOk?.idempotent,
      result_status: payload.resultStatus,
    },
  });
}
