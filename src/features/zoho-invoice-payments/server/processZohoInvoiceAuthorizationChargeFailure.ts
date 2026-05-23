import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { PaystackChargeFailure } from "@/features/payments/server/paystackTypes";
import {
  buildZohoInvoiceAuthorizationChargeWebhookProviderEventId,
  readAuthorizationChargeIdFromMetadata,
} from "@/features/payments/server/detectPaystackWebhookPaymentSource";
import {
  findAuthorizationChargeById,
  findAuthorizationChargeByReference,
  insertAuthorizationChargeEvent,
  markAuthorizationChargeFailed,
} from "./zohoInvoiceAuthorizationChargeRepository";

export type ProcessZohoInvoiceAuthorizationChargeFailureResult =
  | {
      ok: true;
      handled: true;
      source: "zoho_invoice_authorization_charge";
      invoiceNumber: string;
      status: "failed";
      idempotent: boolean;
    }
  | { ok: true; handled: false; reason: string; idempotent?: boolean }
  | { ok: false; code: string; message: string };

async function resolveChargeRow(
  charge: PaystackChargeFailure,
  client: SupabaseClient<Database>,
) {
  const byReference = await findAuthorizationChargeByReference(charge.reference, client);
  if (byReference) return byReference;

  const chargeId = readAuthorizationChargeIdFromMetadata(charge.metadata);
  if (chargeId) {
    return findAuthorizationChargeById(chargeId, client);
  }

  return null;
}

export async function processZohoInvoiceAuthorizationChargeFailure(
  charge: PaystackChargeFailure,
  eventType = "charge.failed",
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ProcessZohoInvoiceAuthorizationChargeFailureResult> {
  const chargeRow = await resolveChargeRow(charge, client);
  if (!chargeRow) {
    return { ok: true, handled: false, reason: "authorization_charge_not_found" };
  }

  const providerEventId = buildZohoInvoiceAuthorizationChargeWebhookProviderEventId(
    "charge.failed",
    charge.transactionId,
  );

  let chargeEvent: "inserted" | "duplicate";
  try {
    const recorded = await insertAuthorizationChargeEvent(
      {
        authorizationChargeId: chargeRow.id,
        providerEventId,
        eventType,
        paystackReference: charge.reference,
        payload: {
          transactionId: charge.transactionId,
          amountCents: charge.amountCents,
          paystackStatus: charge.paystackStatus,
          source: "webhook",
        },
      },
      client,
    );
    chargeEvent = recorded.outcome;
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Could not record authorization charge event row.",
    };
  }

  if (chargeRow.status === "failed") {
    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "failed",
      idempotent: true,
    };
  }

  await markAuthorizationChargeFailed(chargeRow.id, {
    paystackStatus: charge.paystackStatus ?? "failed",
    reason: "paystack_charge_failed",
  });

  logZohoInvoicePaymentEvent("zoho_invoice_admin_charge_failed", {
    invoiceNumber: chargeRow.invoice_number,
    paystackReference: charge.reference,
    authorizationChargeId: chargeRow.id,
    failureCode: "paystack_webhook_failed",
    outcome: "failed",
  });

  return {
    ok: true,
    handled: true,
    source: "zoho_invoice_authorization_charge",
    invoiceNumber: chargeRow.invoice_number,
    status: "failed",
    idempotent: chargeEvent === "duplicate",
  };
}
