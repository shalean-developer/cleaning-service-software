import "server-only";

import { syncZohoMonthlyInvoicePaymentStatus } from "./syncZohoMonthlyInvoicePaymentStatus";

/**
 * Best-effort monthly batch payment sync after a Zoho invoice payment row is marked paid.
 * Does not alter zoho_invoice_payments processing or booking lifecycle.
 */
export async function runPostZohoInvoicePaymentMonthlyBatchSync(input: {
  invoiceNumber: string;
  zohoInvoiceId: string;
}): Promise<void> {
  await syncZohoMonthlyInvoicePaymentStatus({
    invoiceNumber: input.invoiceNumber,
    invoiceId: input.zohoInvoiceId,
    source: "webhook_reconcile",
  }).catch(() => undefined);
}
