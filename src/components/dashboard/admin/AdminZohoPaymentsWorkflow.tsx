"use client";

import { useMemo, useState } from "react";
import { AdminZohoChargeSavedCardFlow } from "./AdminZohoChargeSavedCardFlow";
import { AdminZohoInvoiceMessageTemplates } from "./AdminZohoInvoiceMessageTemplates";
import { AdminZohoInvoicePaymentLinkHelper } from "./AdminZohoInvoicePaymentLinkHelper";

type Props = {
  initialInvoiceNumber?: string;
  adminCardChargesEnabled?: boolean;
};

type InvoiceCheckContext = {
  invoiceNumber: string;
  customerName: string | null;
  amountDueDisplay: string;
  canPayNow: boolean;
};

export function AdminZohoPaymentsWorkflow({
  initialInvoiceNumber = "",
  adminCardChargesEnabled = false,
}: Props) {
  const [paymentLink, setPaymentLink] = useState<string | undefined>();
  const [templateInvoiceNumber, setTemplateInvoiceNumber] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState<string | undefined>();
  const [amountDue, setAmountDue] = useState<string | undefined>();
  const [invoiceCheckContext, setInvoiceCheckContext] = useState<InvoiceCheckContext | null>(null);

  const resolvedInvoiceNumber = useMemo(
    () => templateInvoiceNumber ?? initialInvoiceNumber,
    [initialInvoiceNumber, templateInvoiceNumber],
  );

  return (
    <div className="space-y-6">
      <AdminZohoInvoicePaymentLinkHelper
        initialInvoiceNumber={initialInvoiceNumber}
        onLinkGenerated={(result) => {
          setPaymentLink(result.paymentLink);
          setTemplateInvoiceNumber(result.normalizedInvoiceNumber);
        }}
        onInvoiceChecked={(result) => {
          setCustomerName(result.customerName ?? undefined);
          setAmountDue(result.amountDueDisplay);
          setTemplateInvoiceNumber(result.invoiceNumber);
          setInvoiceCheckContext({
            invoiceNumber: result.invoiceNumber,
            customerName: result.customerName,
            amountDueDisplay: result.amountDueDisplay,
            canPayNow: result.canPayNow,
          });
        }}
      />

      <AdminZohoChargeSavedCardFlow
        invoiceContext={invoiceCheckContext}
        adminCardChargesEnabled={adminCardChargesEnabled}
      />

      <AdminZohoInvoiceMessageTemplates
        paymentLink={paymentLink}
        customerName={customerName}
        invoiceNumber={resolvedInvoiceNumber}
        amountDue={amountDue}
      />

      <section className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Future phase: Zoho invoice note automation</h2>
        <p className="mt-2 text-xs leading-relaxed text-zinc-600">
          After an admin creates an invoice in Zoho, Shalean could later update the Zoho invoice note
          through the Zoho API to include the Shalean payment link automatically. That belongs in a
          separate phase with a safe update API, audit logging, and idempotency. It is not implemented
          in this release — copy the templates above into Zoho or customer messages manually.
        </p>
      </section>
    </div>
  );
}
