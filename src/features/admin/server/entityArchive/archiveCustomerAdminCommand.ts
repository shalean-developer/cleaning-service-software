import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerRow, Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  buildAdminArchiveIdempotencyKey,
  finalizeAdminArchiveCommand,
  requireNonEmptyArchiveReason,
  resolveIdempotentAdminArchiveReplay,
} from "./adminArchiveSupport";
import type { AdminArchiveCommandResult, AdminDeleteAction } from "./types";

export type ArchiveCustomerAdminParams = {
  customerId: string;
  adminProfileId: string;
  reason: string;
  action?: AdminDeleteAction;
  idempotencyKey?: string | null;
};

async function loadCustomer(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<CustomerRow | null> {
  const { data, error } = await client.from("customers").select("*").eq("id", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function countCustomerBookings(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<number> {
  const { count, error } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", customerId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countCustomerPaidPayments(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<number> {
  const { data: bookingRows, error: bookingError } = await client
    .from("bookings")
    .select("id")
    .eq("customer_id", customerId);
  if (bookingError) throw new Error(bookingError.message);
  const bookingIds = (bookingRows ?? []).map((r) => r.id);
  if (bookingIds.length === 0) return 0;

  const { count, error } = await client
    .from("payments")
    .select("*", { count: "exact", head: true })
    .in("booking_id", bookingIds)
    .eq("status", "paid");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function archiveCustomerAdminCommand(
  params: ArchiveCustomerAdminParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminArchiveCommandResult> {
  const action = params.action ?? "archive";
  const reasonError = requireNonEmptyArchiveReason(params.reason, "archiveCustomerAdminCommand");
  if (reasonError) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "customer",
      entityId: params.customerId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason: reasonError,
      code: "INVALID_PAYLOAD",
      message: reasonError,
    });
  }

  const customer = await loadCustomer(client, params.customerId);
  if (!customer) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "customer",
      entityId: params.customerId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason: "Customer not found.",
      code: "CUSTOMER_NOT_FOUND",
      message: "Customer not found.",
    });
  }

  const idempotencyKey = buildAdminArchiveIdempotencyKey(
    "customer",
    action,
    params.customerId,
    params.adminProfileId,
    params.idempotencyKey,
  );

  const replay = await resolveIdempotentAdminArchiveReplay(
    client,
    idempotencyKey,
    "customer",
    params.customerId,
  );
  if (replay) return replay;

  const [bookingCount, paidPaymentCount] = await Promise.all([
    countCustomerBookings(client, params.customerId),
    countCustomerPaidPayments(client, params.customerId),
  ]);

  if (action === "delete" && (bookingCount > 0 || paidPaymentCount > 0)) {
    const blockedReason =
      bookingCount > 0
        ? "Customer has booking history."
        : "Customer has payment history.";
    return finalizeAdminArchiveCommand(client, {
      entityType: "customer",
      entityId: params.customerId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason,
      idempotencyKey,
      code: "CUSTOMER_HISTORY_BLOCK",
      message:
        "This customer cannot be hard-deleted because bookings or payments exist. Archive the profile instead; booking history will be preserved.",
      metadata: { bookingCount, paidPaymentCount },
      affectedCounts: { bookingCount, paidPaymentCount },
    });
  }

  if (action === "delete") {
    const { error: deleteError } = await client
      .from("customers")
      .delete()
      .eq("id", params.customerId);

    if (deleteError) {
      return finalizeAdminArchiveCommand(client, {
        entityType: "customer",
        entityId: params.customerId,
        adminProfileId: params.adminProfileId,
        action,
        outcome: "failed",
        reason: params.reason,
        code: "PERSISTENCE_ERROR",
        message: deleteError.message,
        idempotencyKey,
      });
    }

    return finalizeAdminArchiveCommand(client, {
      entityType: "customer",
      entityId: params.customerId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "success",
      reason: params.reason,
      idempotencyKey,
      message: "Customer permanently deleted.",
      metadata: { bookingCount, paidPaymentCount, permanentlyDeleted: true },
      affectedCounts: { bookingCount, paidPaymentCount },
    });
  }

  if (customer.deleted_at) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "customer",
      entityId: params.customerId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "idempotent",
      reason: params.reason,
      idempotencyKey,
      message: "Customer is already archived.",
    });
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await client
    .from("customers")
    .update({
      deleted_at: nowIso,
      deleted_by_profile_id: params.adminProfileId,
      delete_reason: params.reason.trim(),
      updated_at: nowIso,
    })
    .eq("id", params.customerId);

  if (updateError) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "customer",
      entityId: params.customerId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "failed",
      reason: params.reason,
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      idempotencyKey,
    });
  }

  return finalizeAdminArchiveCommand(client, {
    entityType: "customer",
    entityId: params.customerId,
    adminProfileId: params.adminProfileId,
    action,
    outcome: "success",
    reason: params.reason,
    idempotencyKey,
    message: "Customer archived. Booking and payment history are preserved.",
    metadata: { bookingCount, paidPaymentCount },
    affectedCounts: { bookingCount, paidPaymentCount },
  });
}
