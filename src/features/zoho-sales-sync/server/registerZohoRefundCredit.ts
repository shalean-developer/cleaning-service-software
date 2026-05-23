import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ZohoRefundCreditSyncSourceType } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { loadRefundCreditSourceContext, validateRefundCreditAmount } from "./loadRefundCreditSource";
import { runPostRefundZohoCreditSync } from "./runPostRefundZohoCreditSync";
import { requireZohoRefundCreditSyncEnabled } from "./zohoRefundCreditSyncLaunchGuard";

export const REGISTER_CREDIT_CONFIRM_PHRASE = "REGISTER CREDIT";

export type RegisterZohoRefundCreditInput = {
  sourceType: ZohoRefundCreditSyncSourceType;
  sourceId: string;
  amountCents: number;
  reason: string;
  confirmPhrase: string;
  bookingId?: string | null;
  invoiceNumber?: string | null;
  zohoInvoiceId?: string | null;
  paystackReference?: string | null;
  initiatedByAdminId: string;
};

export type RegisterZohoRefundCreditResult =
  | { ok: true; syncId: string; enqueued: boolean }
  | { ok: false; code: string; message: string; status: number };

export async function registerZohoRefundCredit(
  input: RegisterZohoRefundCreditInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<RegisterZohoRefundCreditResult> {
  const gate = requireZohoRefundCreditSyncEnabled();
  if (!gate.ok) {
    return { ok: false, code: gate.code, message: gate.message, status: 503 };
  }

  if (input.confirmPhrase.trim() !== REGISTER_CREDIT_CONFIRM_PHRASE) {
    return {
      ok: false,
      code: "CONFIRM_PHRASE_REQUIRED",
      message: `Confirmation phrase must be "${REGISTER_CREDIT_CONFIRM_PHRASE}".`,
      status: 400,
    };
  }

  if (!input.reason.trim()) {
    return {
      ok: false,
      code: "REASON_REQUIRED",
      message: "Reason is required.",
      status: 400,
    };
  }

  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      message: "Amount must be greater than zero.",
      status: 400,
    };
  }

  const validation = await validateRefundCreditAmount(
    {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amountCents: input.amountCents,
      bookingId: input.bookingId,
      zohoInvoicePaymentId:
        input.sourceType === "zoho_invoice_refund" ? input.sourceId : undefined,
      authorizationChargeId:
        input.sourceType === "zoho_authorization_charge_refund" ? input.sourceId : undefined,
    },
    client,
  );

  if (!validation.ok) {
    return {
      ok: false,
      code: validation.code,
      message: validation.message,
      status: validation.code === "AMOUNT_EXCEEDS_PAID" ? 400 : 404,
    };
  }

  const context = await loadRefundCreditSourceContext(
    input.sourceType,
    input.sourceId,
    {
      booking_id: input.bookingId ?? null,
      invoice_number: input.invoiceNumber ?? null,
      zoho_invoice_id: input.zohoInvoiceId ?? null,
      paystack_reference: input.paystackReference ?? null,
      amount_cents: input.amountCents,
      currency: "ZAR",
    },
    client,
  );

  await runPostRefundZohoCreditSync(client, {
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    bookingId: input.bookingId ?? null,
    invoiceNumber: input.invoiceNumber ?? context?.invoiceNumber ?? null,
    zohoInvoiceId: input.zohoInvoiceId ?? context?.zohoInvoiceId ?? null,
    paystackReference: input.paystackReference ?? context?.paystackReference ?? null,
    amountCents: input.amountCents,
    currency: context?.currency ?? "ZAR",
    reason: input.reason.trim(),
    initiatedByAdminId: input.initiatedByAdminId,
  });

  const { data: row } = await client
    .from("zoho_refund_credit_sync")
    .select("id")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();

  return {
    ok: true,
    syncId: row?.id ?? input.sourceId,
    enqueued: true,
  };
}
