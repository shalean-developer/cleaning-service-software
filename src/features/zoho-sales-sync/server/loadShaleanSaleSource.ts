import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCustomerEmail } from "@/features/notifications/server/resolveCustomerEmail";
import {
  resolveServiceSlugFromMetadata,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import type { Database, ZohoSalesSyncSourceType } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getPaymentById } from "@/features/payments/server/paymentRepository";

export type ShaleanSaleSource =
  | {
      sourceType: "booking";
      bookingId: string;
      paymentId: string;
      customerEmail: string;
      customerName: string | null;
      serviceName: string;
      bookingDate: string;
      amountCents: number;
      currency: string;
      paystackReference: string;
      paymentDate: string;
    }
  | {
      sourceType: "zoho_invoice_payment";
      zohoInvoicePaymentId: string;
      invoiceNumber: string;
      zohoInvoiceId: string;
      zohoPaymentId: string | null;
      customerEmail: string;
      amountCents: number;
      currency: string;
      paystackReference: string | null;
      paymentDate: string | null;
    }
  | {
      sourceType: "zoho_authorization_charge";
      authorizationChargeId: string;
      invoiceNumber: string;
      zohoInvoiceId: string;
      zohoPaymentId: string | null;
      customerEmail: string;
      amountCents: number;
      currency: string;
      paystackReference: string;
      paymentDate: string | null;
    };

export async function loadShaleanSaleSource(
  sourceType: ZohoSalesSyncSourceType,
  sourceId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ShaleanSaleSource | null> {
  switch (sourceType) {
    case "booking":
      return loadBookingSaleSource(sourceId, client);
    case "zoho_invoice_payment":
      return loadZohoInvoicePaymentSaleSource(sourceId, client);
    case "zoho_authorization_charge":
      return loadZohoAuthorizationChargeSaleSource(sourceId, client);
  }
}

async function loadBookingSaleSource(
  bookingId: string,
  client: SupabaseClient<Database>,
): Promise<ShaleanSaleSource | null> {
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, customer_id, scheduled_start, price_cents, currency, metadata, updated_at")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) throw new Error(bookingError.message);
  if (!booking) return null;

  const { data: payment, error: paymentError } = await client
    .from("payments")
    .select("id, status, provider_ref, amount_cents, currency, updated_at")
    .eq("booking_id", bookingId)
    .eq("status", "paid")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (paymentError) throw new Error(paymentError.message);
  if (!payment?.provider_ref) return null;

  const resolved = await resolveCustomerEmail(client, booking.customer_id);
  if (!resolved.ok) return null;

  const serviceSlug = resolveServiceSlugFromMetadata(booking.metadata);
  const serviceName = serviceLabelFromSlug(serviceSlug);

  return {
    sourceType: "booking",
    bookingId: booking.id,
    paymentId: payment.id,
    customerEmail: resolved.recipient.email,
    customerName: resolved.recipient.displayName,
    serviceName,
    bookingDate: booking.scheduled_start,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    paystackReference: payment.provider_ref,
    paymentDate: payment.updated_at,
  };
}

async function loadZohoInvoicePaymentSaleSource(
  zohoInvoicePaymentId: string,
  client: SupabaseClient<Database>,
): Promise<ShaleanSaleSource | null> {
  const { data, error } = await client
    .from("zoho_invoice_payments")
    .select(
      "id, invoice_number, zoho_invoice_id, customer_email, amount_cents, currency, paystack_reference, zoho_payment_id, paid_at, updated_at, status",
    )
    .eq("id", zohoInvoicePaymentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    sourceType: "zoho_invoice_payment",
    zohoInvoicePaymentId: data.id,
    invoiceNumber: data.invoice_number,
    zohoInvoiceId: data.zoho_invoice_id,
    zohoPaymentId: data.zoho_payment_id,
    customerEmail: data.customer_email,
    amountCents: data.amount_cents,
    currency: data.currency,
    paystackReference: data.paystack_reference,
    paymentDate: data.paid_at ?? data.updated_at,
  };
}

async function loadZohoAuthorizationChargeSaleSource(
  authorizationChargeId: string,
  client: SupabaseClient<Database>,
): Promise<ShaleanSaleSource | null> {
  const { data, error } = await client
    .from("zoho_invoice_authorization_charges")
    .select(
      "id, invoice_number, zoho_invoice_id, customer_email, amount_cents, currency, paystack_reference, zoho_payment_id, paid_at, updated_at, status",
    )
    .eq("id", authorizationChargeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    sourceType: "zoho_authorization_charge",
    authorizationChargeId: data.id,
    invoiceNumber: data.invoice_number,
    zohoInvoiceId: data.zoho_invoice_id,
    zohoPaymentId: data.zoho_payment_id,
    customerEmail: data.customer_email,
    amountCents: data.amount_cents,
    currency: data.currency,
    paystackReference: data.paystack_reference,
    paymentDate: data.paid_at ?? data.updated_at,
  };
}

export async function loadBookingSaleSourceByPaymentId(
  paymentId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ShaleanSaleSource | null> {
  const payment = await getPaymentById(client, paymentId);
  if (!payment || payment.status !== "paid") return null;
  return loadBookingSaleSource(payment.booking_id, client);
}
