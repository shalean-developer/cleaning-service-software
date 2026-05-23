import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import {
  sendMonthlyInvoiceToCustomer,
  type SendMonthlyInvoiceToCustomerResult,
} from "./sendMonthlyInvoiceToCustomer";
import {
  sendMonthlyInvoiceReminder,
  type SendMonthlyInvoiceReminderResult,
} from "./sendMonthlyInvoiceReminder";
import {
  markMonthlyInvoiceOverdue,
  type MarkMonthlyInvoiceOverdueResult,
} from "./markMonthlyInvoiceOverdue";

function adminGuard(user: CurrentUser): { ok: false; code: string; message: string; status: number } | null {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }
  return null;
}

export type SendMonthlyInvoiceForAdminInput = {
  admin: CurrentUser;
  batchId: string;
  idempotencyKey: string;
  reason?: string;
};

export type SendMonthlyInvoiceForAdminResult =
  | Extract<SendMonthlyInvoiceToCustomerResult, { ok: true }>
  | { ok: false; code: string; message: string; status: number };

export async function sendMonthlyInvoiceForAdmin(
  input: SendMonthlyInvoiceForAdminInput,
): Promise<SendMonthlyInvoiceForAdminResult> {
  const denied = adminGuard(input.admin);
  if (denied) return denied;

  const result = await sendMonthlyInvoiceToCustomer({
    batchId: input.batchId,
    adminProfileId: input.admin.profileId,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
  });

  if (!result.ok) {
    const status =
      result.code === "BATCH_NOT_FOUND"
        ? 404
        : result.code === "FEATURE_DISABLED"
          ? 403
          : 422;
    return { ok: false, code: result.code, message: result.message, status };
  }

  return result;
}

export type SendMonthlyInvoiceReminderForAdminInput = {
  admin: CurrentUser;
  batchId: string;
  idempotencyKey: string;
  reason?: string;
};

export type SendMonthlyInvoiceReminderForAdminResult =
  | Extract<SendMonthlyInvoiceReminderResult, { ok: true }>
  | { ok: false; code: string; message: string; status: number };

export async function sendMonthlyInvoiceReminderForAdmin(
  input: SendMonthlyInvoiceReminderForAdminInput,
): Promise<SendMonthlyInvoiceReminderForAdminResult> {
  const denied = adminGuard(input.admin);
  if (denied) return denied;

  const result = await sendMonthlyInvoiceReminder({
    batchId: input.batchId,
    adminProfileId: input.admin.profileId,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
  });

  if (!result.ok) {
    const status =
      result.code === "BATCH_NOT_FOUND"
        ? 404
        : result.code === "FEATURE_DISABLED"
          ? 403
          : 422;
    return { ok: false, code: result.code, message: result.message, status };
  }

  return result;
}

export type MarkMonthlyInvoiceOverdueForAdminInput = {
  admin: CurrentUser;
  batchId: string;
  idempotencyKey: string;
  reason?: string;
  force?: boolean;
};

export type MarkMonthlyInvoiceOverdueForAdminResult =
  | Extract<MarkMonthlyInvoiceOverdueResult, { ok: true }>
  | { ok: false; code: string; message: string; status: number };

export async function markMonthlyInvoiceOverdueForAdmin(
  input: MarkMonthlyInvoiceOverdueForAdminInput,
): Promise<MarkMonthlyInvoiceOverdueForAdminResult> {
  const denied = adminGuard(input.admin);
  if (denied) return denied;

  const result = await markMonthlyInvoiceOverdue({
    batchId: input.batchId,
    adminProfileId: input.admin.profileId,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
    force: input.force,
  });

  if (!result.ok) {
    const status =
      result.code === "BATCH_NOT_FOUND"
        ? 404
        : result.code === "FEATURE_DISABLED"
          ? 403
          : result.code === "NOT_PAST_DUE"
            ? 409
            : 422;
    return { ok: false, code: result.code, message: result.message, status };
  }

  return result;
}
