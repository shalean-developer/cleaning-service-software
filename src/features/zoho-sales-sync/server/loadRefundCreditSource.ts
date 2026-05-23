import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ZohoRefundCreditSyncSourceType,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { findZohoSalesSyncBySource } from "./zohoSalesSyncRepository";

export type RefundCreditSourceContext = {
  zohoInvoiceId: string;
  invoiceNumber: string | null;
  customerId: string | null;
  paystackReference: string | null;
  originalPaidAmountCents: number;
  currency: string;
  lineItemName: string;
};

export async function loadRefundCreditSourceContext(
  sourceType: ZohoRefundCreditSyncSourceType,
  sourceId: string,
  syncRow: {
    booking_id: string | null;
    invoice_number: string | null;
    zoho_invoice_id: string | null;
    paystack_reference: string | null;
    amount_cents: number;
    currency: string;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<RefundCreditSourceContext | null> {
  switch (sourceType) {
    case "booking_refund":
    case "booking_cancellation":
      return loadBookingRefundContext(sourceId, syncRow, client);
    case "zoho_invoice_refund":
      return loadZohoInvoicePaymentRefundContext(sourceId, syncRow, client);
    case "zoho_authorization_charge_refund":
      return loadZohoAuthorizationChargeRefundContext(sourceId, syncRow, client);
  }
}

async function loadBookingRefundContext(
  bookingId: string,
  syncRow: {
    booking_id: string | null;
    invoice_number: string | null;
    zoho_invoice_id: string | null;
    paystack_reference: string | null;
    currency: string;
  },
  client: SupabaseClient<Database>,
): Promise<RefundCreditSourceContext | null> {
  const resolvedBookingId = syncRow.booking_id ?? bookingId;

  const salesSync = await findZohoSalesSyncBySource("booking", resolvedBookingId, client);

  let zohoInvoiceId = syncRow.zoho_invoice_id ?? salesSync?.zoho_invoice_id ?? null;
  let invoiceNumber = syncRow.invoice_number ?? salesSync?.invoice_number ?? null;

  const { data: payment, error: paymentError } = await client
    .from("payments")
    .select("amount_cents, currency, provider_ref, status")
    .eq("booking_id", resolvedBookingId)
    .in("status", ["paid", "refunded"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) throw new Error(paymentError.message);
  if (!payment) return null;

  if (!zohoInvoiceId && salesSync?.zoho_invoice_id) {
    zohoInvoiceId = salesSync.zoho_invoice_id;
    invoiceNumber = salesSync.invoice_number;
  }

  if (!zohoInvoiceId) return null;

  return {
    zohoInvoiceId,
    invoiceNumber,
    customerId: salesSync?.zoho_customer_id ?? null,
    paystackReference: syncRow.paystack_reference ?? payment.provider_ref,
    originalPaidAmountCents: payment.amount_cents,
    currency: payment.currency ?? syncRow.currency,
    lineItemName: "Booking refund / cancellation credit",
  };
}

async function loadZohoInvoicePaymentRefundContext(
  zohoInvoicePaymentId: string,
  syncRow: {
    invoice_number: string | null;
    zoho_invoice_id: string | null;
    paystack_reference: string | null;
    currency: string;
  },
  client: SupabaseClient<Database>,
): Promise<RefundCreditSourceContext | null> {
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .select(
      "invoice_number, zoho_invoice_id, paystack_reference, amount_cents, currency, status",
    )
    .eq("id", zohoInvoicePaymentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.status !== "paid") return null;

  const zohoInvoiceId = syncRow.zoho_invoice_id ?? data.zoho_invoice_id;
  if (!zohoInvoiceId) return null;

  const salesSync = await findZohoSalesSyncBySource(
    "zoho_invoice_payment",
    zohoInvoicePaymentId,
    client,
  );

  return {
    zohoInvoiceId,
    invoiceNumber: syncRow.invoice_number ?? data.invoice_number,
    customerId: salesSync?.zoho_customer_id ?? null,
    paystackReference: syncRow.paystack_reference ?? data.paystack_reference,
    originalPaidAmountCents: data.amount_cents,
    currency: data.currency ?? syncRow.currency,
    lineItemName: "Zoho invoice payment refund credit",
  };
}

async function loadZohoAuthorizationChargeRefundContext(
  authorizationChargeId: string,
  syncRow: {
    invoice_number: string | null;
    zoho_invoice_id: string | null;
    paystack_reference: string | null;
    currency: string;
  },
  client: SupabaseClient<Database>,
): Promise<RefundCreditSourceContext | null> {
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .select(
      "invoice_number, zoho_invoice_id, paystack_reference, amount_cents, currency, status",
    )
    .eq("id", authorizationChargeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.status !== "paid") return null;

  const zohoInvoiceId = syncRow.zoho_invoice_id ?? data.zoho_invoice_id;
  if (!zohoInvoiceId) return null;

  const salesSync = await findZohoSalesSyncBySource(
    "zoho_authorization_charge",
    authorizationChargeId,
    client,
  );

  return {
    zohoInvoiceId,
    invoiceNumber: syncRow.invoice_number ?? data.invoice_number,
    customerId: salesSync?.zoho_customer_id ?? null,
    paystackReference: syncRow.paystack_reference ?? data.paystack_reference,
    originalPaidAmountCents: data.amount_cents,
    currency: data.currency ?? syncRow.currency,
    lineItemName: "Authorization charge refund credit",
  };
}

export type ValidateRefundCreditAmountInput = {
  sourceType: ZohoRefundCreditSyncSourceType;
  sourceId: string;
  amountCents: number;
  bookingId?: string | null;
  zohoInvoicePaymentId?: string | null;
  authorizationChargeId?: string | null;
};

export type ValidateRefundCreditAmountResult =
  | { ok: true; originalPaidAmountCents: number; alreadyCreditedCents: number }
  | { ok: false; code: string; message: string };

export async function validateRefundCreditAmount(
  input: ValidateRefundCreditAmountInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ValidateRefundCreditAmountResult> {
  const bookingId = resolveBookingIdForValidation(input);

  const context = await loadRefundCreditSourceContext(
    input.sourceType,
    input.sourceId,
    {
      booking_id: bookingId,
      invoice_number: null,
      zoho_invoice_id: null,
      paystack_reference: null,
      amount_cents: input.amountCents,
      currency: "ZAR",
    },
    client,
  );

  if (!context) {
    return {
      ok: false,
      code: "SOURCE_NOT_FOUND",
      message: "Could not resolve paid source for refund validation.",
    };
  }

  const alreadyCreditedCents = await sumExistingRefundCredits(input, bookingId, client);

  if (alreadyCreditedCents + input.amountCents > context.originalPaidAmountCents) {
    return {
      ok: false,
      code: "AMOUNT_EXCEEDS_PAID",
      message: "Refund amount exceeds original paid amount.",
    };
  }

  return {
    ok: true,
    originalPaidAmountCents: context.originalPaidAmountCents,
    alreadyCreditedCents,
  };
}

function resolveBookingIdForValidation(input: ValidateRefundCreditAmountInput): string | null {
  if (input.bookingId) return input.bookingId;
  if (
    input.sourceType === "booking_refund" ||
    input.sourceType === "booking_cancellation"
  ) {
    return input.sourceId;
  }
  return null;
}

async function sumExistingRefundCredits(
  input: ValidateRefundCreditAmountInput,
  bookingId: string | null,
  client: SupabaseClient<Database>,
): Promise<number> {
  if (bookingId) {
    const { data, error } = await client
      .from("zoho_refund_credit_sync")
      .select("amount_cents, source_type, source_id")
      .eq("booking_id", bookingId)
      .in("sync_status", ["pending", "synced"]);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter(
        (row) =>
          !(row.source_type === input.sourceType && row.source_id === input.sourceId),
      )
      .reduce((sum, row) => sum + row.amount_cents, 0);
  }

  if (input.sourceType === "zoho_invoice_refund" && input.zohoInvoicePaymentId) {
    const { data, error } = await client
      .from("zoho_refund_credit_sync")
      .select("amount_cents, source_type, source_id")
      .eq("source_type", "zoho_invoice_refund")
      .in("sync_status", ["pending", "synced"]);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => {
        if (row.source_type === input.sourceType && row.source_id === input.sourceId) {
          return false;
        }
        return row.source_id === input.zohoInvoicePaymentId;
      })
      .reduce((sum, row) => sum + row.amount_cents, 0);
  }

  if (input.sourceType === "zoho_authorization_charge_refund" && input.authorizationChargeId) {
    const { data, error } = await client
      .from("zoho_refund_credit_sync")
      .select("amount_cents, source_type, source_id")
      .eq("source_type", "zoho_authorization_charge_refund")
      .in("sync_status", ["pending", "synced"]);

    if (error) throw new Error(error.message);

    return (data ?? [])
      .filter((row) => {
        if (row.source_type === input.sourceType && row.source_id === input.sourceId) {
          return false;
        }
        return row.source_id === input.authorizationChargeId;
      })
      .reduce((sum, row) => sum + row.amount_cents, 0);
  }

  const { data, error } = await client
    .from("zoho_refund_credit_sync")
    .select("amount_cents")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .in("sync_status", ["pending", "synced"]);

  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + row.amount_cents, 0);
}
