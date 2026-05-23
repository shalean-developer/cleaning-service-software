import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { isZohoMonthlyInvoicePaymentSyncEnabled } from "@/lib/app/zohoMonthlyInvoicePaymentSyncFlag";
import {
  syncZohoMonthlyInvoicePaymentStatus,
  type MonthlyInvoicePaymentSyncSummary,
} from "./syncZohoMonthlyInvoicePaymentStatus";

export type SyncMonthlyInvoicePaymentStatusAdminInput = {
  admin: CurrentUser;
  batchId: string;
  idempotencyKey: string;
  reason?: string;
};

export type SyncMonthlyInvoicePaymentStatusAdminResult =
  | { ok: true; sync: MonthlyInvoicePaymentSyncSummary; outcome: string }
  | { ok: false; code: string; message: string; status: number };

export async function syncMonthlyInvoicePaymentStatusForAdmin(
  input: SyncMonthlyInvoicePaymentStatusAdminInput,
): Promise<SyncMonthlyInvoicePaymentStatusAdminResult> {
  if (input.admin.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  if (!isZohoMonthlyInvoicePaymentSyncEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Monthly invoice payment sync is disabled (ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED).",
      status: 403,
    };
  }

  const result = await syncZohoMonthlyInvoicePaymentStatus({
    batchId: input.batchId,
    source: "manual",
    adminProfileId: input.admin.profileId,
    idempotencyKey: input.idempotencyKey,
    reason: input.reason,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      status: result.code === "ZOHO_UNAVAILABLE" ? 502 : 422,
    };
  }

  if (result.outcome === "skipped") {
    return {
      ok: false,
      code: result.code,
      message: result.reason,
      status: result.code === "BATCH_NOT_FOUND" ? 404 : 409,
    };
  }

  return { ok: true, sync: result.sync, outcome: result.outcome };
}
