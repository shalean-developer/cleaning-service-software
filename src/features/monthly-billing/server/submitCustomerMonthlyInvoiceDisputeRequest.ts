import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getMonthlyInvoiceBatch } from "./monthlyInvoiceBatchRepository";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type SubmitCustomerMonthlyInvoiceDisputeInput = {
  invoiceId: string;
  customerId: string;
  message: string;
  idempotencyKey: string;
  client?: SupabaseClient<Database>;
};

export type SubmitCustomerMonthlyInvoiceDisputeResult =
  | { ok: true; batchId: string }
  | { ok: false; code: string; message: string };

export async function submitCustomerMonthlyInvoiceDisputeRequest(
  input: SubmitCustomerMonthlyInvoiceDisputeInput,
): Promise<SubmitCustomerMonthlyInvoiceDisputeResult> {
  const client = input.client ?? requireServiceRoleClient();
  const batch = await getMonthlyInvoiceBatch(input.invoiceId, client);
  if (!batch) {
    return { ok: false, code: "INVOICE_NOT_FOUND", message: "Invoice not found." };
  }

  if (batch.customerId !== input.customerId) {
    return { ok: false, code: "FORBIDDEN", message: "You cannot dispute this invoice." };
  }

  if (batch.status === "paid" || batch.status === "void" || batch.status === "draft") {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: "This invoice cannot be disputed in its current state.",
    };
  }

  const account = await getCustomerBillingAccount(batch.customerId, client);
  await recordCustomerBillingAccountAudit(client, {
    accountId: account?.id ?? null,
    customerId: batch.customerId,
    adminProfileId: null,
    action: "monthly_invoice_dispute_requested",
    idempotencyKey: input.idempotencyKey,
    reason: input.message.trim(),
    extra: {
      batchId: batch.id,
      invoiceNumber: batch.zohoInvoiceNumber,
      source: "customer_portal",
    },
  }).catch(() => undefined);

  return { ok: true, batchId: batch.id };
}

export async function submitCustomerMonthlyInvoiceDisputeForUser(
  user: CurrentUser,
  input: { invoiceId: string; message: string; idempotencyKey: string },
): Promise<SubmitCustomerMonthlyInvoiceDisputeResult> {
  const serverClient = await createSupabaseServerClient();
  if (!serverClient) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured." };
  }

  const scope = await resolveActorScope(serverClient, user.profileId, user.role);
  const customerId = scope.actingCustomerId;
  if (!customerId) {
    return { ok: false, code: "FORBIDDEN", message: "Customer account not found." };
  }

  return submitCustomerMonthlyInvoiceDisputeRequest({
    invoiceId: input.invoiceId,
    customerId,
    message: input.message,
    idempotencyKey: input.idempotencyKey,
    client: requireServiceRoleClient(),
  });
}
