import "server-only";

import type { ZohoInvoicePaymentStatus } from "@/lib/database/types";
import { findZohoInvoicePaymentByReference } from "./zohoInvoicePaymentRepository";
import { readAuthorizationCaptureOutcomeFromMetadata } from "./zohoInvoiceSavePaymentMethodConsent";

export type ZohoInvoicePaymentPublicStatus =
  | "pending_paystack"
  | "paid"
  | "failed"
  | "zoho_reconcile_pending"
  | "zoho_reconcile_failed"
  | "unknown";

const PUBLIC_STATUS_MESSAGES: Record<ZohoInvoicePaymentPublicStatus, string> = {
  paid: "Payment successful. Your invoice has been marked paid.",
  zoho_reconcile_pending: "Payment received. We are finalising your invoice receipt.",
  pending_paystack: "Payment is being confirmed.",
  failed: "Payment was not successful.",
  zoho_reconcile_failed:
    "We received your payment but could not finalise your invoice automatically. Please contact support with your payment reference.",
  unknown:
    "We could not confirm your payment status yet. Please contact support with your payment reference.",
};

function mapRowStatusToPublicStatus(
  status: ZohoInvoicePaymentStatus,
): ZohoInvoicePaymentPublicStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "zoho_reconcile_pending":
      return "zoho_reconcile_pending";
    case "zoho_reconcile_failed":
      return "zoho_reconcile_failed";
    case "pending_paystack":
    case "initialized":
      return "pending_paystack";
    default:
      return "unknown";
  }
}

export function publicMessageForZohoInvoicePaymentStatus(
  status: ZohoInvoicePaymentPublicStatus,
): string {
  return PUBLIC_STATUS_MESSAGES[status];
}

export type FetchZohoInvoicePaymentStatusResult =
  | {
      ok: true;
      invoiceNumber: string;
      reference: string;
      status: ZohoInvoicePaymentPublicStatus;
      message: string;
      saveMethodMessage: string | null;
    }
  | { ok: false; code: "INVALID_REFERENCE" | "NOT_FOUND"; message: string };

function saveMethodMessageForCaptureOutcome(
  outcome: ReturnType<typeof readAuthorizationCaptureOutcomeFromMetadata>,
): string | null {
  switch (outcome) {
    case "saved":
      return "Your payment method was saved for future approved Shalean invoices.";
    case "not_reusable":
      return "Payment successful. This card could not be saved for future use.";
    default:
      return null;
  }
}

const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{4,120}$/;

export function validatePaystackReferenceForStatusLookup(reference: string): boolean {
  const trimmed = reference.trim();
  return REFERENCE_PATTERN.test(trimmed);
}

export async function fetchZohoInvoicePaymentStatusByReference(
  reference: string,
): Promise<FetchZohoInvoicePaymentStatusResult> {
  const trimmed = reference.trim();
  if (!validatePaystackReferenceForStatusLookup(trimmed)) {
    return {
      ok: false,
      code: "INVALID_REFERENCE",
      message: "Invalid payment reference.",
    };
  }

  const row = await findZohoInvoicePaymentByReference(trimmed);
  if (!row) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "We could not find this payment reference.",
    };
  }

  const status = mapRowStatusToPublicStatus(row.status);
  const captureOutcome = readAuthorizationCaptureOutcomeFromMetadata(row.metadata);
  const saveMethodMessage =
    status === "paid" ? saveMethodMessageForCaptureOutcome(captureOutcome) : null;

  return {
    ok: true,
    invoiceNumber: row.invoice_number,
    reference: trimmed,
    status,
    message: publicMessageForZohoInvoicePaymentStatus(status),
    saveMethodMessage,
  };
}
