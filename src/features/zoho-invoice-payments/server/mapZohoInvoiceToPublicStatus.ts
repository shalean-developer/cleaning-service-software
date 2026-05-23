import "server-only";

import type { ZohoInvoicePaymentPublicStatus } from "./types";

export type MapZohoInvoiceToPublicStatusInput = {
  zohoStatus?: string | null;
  balanceCents: number;
  invoiceTotalCents?: number | null;
  /** When set, overrides invoice-field mapping (operational outcomes). */
  outcome?: "not_configured" | "not_found" | "error";
};

function normalizeZohoStatus(status: string | null | undefined): string {
  return status?.trim().toLowerCase() ?? "";
}

function isVoidZohoStatus(zohoStatus: string): boolean {
  return (
    zohoStatus === "void" || zohoStatus === "cancelled" || zohoStatus === "canceled"
  );
}

/**
 * Maps Zoho invoice fields or operational outcomes to the public invoice status.
 */
export function mapZohoInvoiceToPublicStatus(
  input: MapZohoInvoiceToPublicStatusInput,
): ZohoInvoicePaymentPublicStatus {
  if (input.outcome === "not_configured") return "not_configured";
  if (input.outcome === "not_found") return "not_found";
  if (input.outcome === "error") return "error";

  const zohoStatus = normalizeZohoStatus(input.zohoStatus);

  if (isVoidZohoStatus(zohoStatus)) {
    return "void";
  }

  if (zohoStatus === "paid" || input.balanceCents <= 0) {
    return "paid";
  }

  if (input.balanceCents > 0) {
    return "payable";
  }

  return "error";
}
