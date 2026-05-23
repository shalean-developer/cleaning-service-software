"use client";

import { useCallback, useState } from "react";
import {
  ZOHO_INVOICE_EMAIL_MESSAGE_TEMPLATE,
  ZOHO_INVOICE_EMAIL_SUBJECT_TEMPLATE,
  ZOHO_INVOICE_NOTE_TEMPLATE,
  fillZohoInvoiceMessageTemplate,
} from "@/features/zoho-invoice-payments/server/zohoInvoiceAdminMessageTemplates";
import { AdminZohoCopyLinkButton } from "./AdminZohoPaymentLinkActions";

type Props = {
  paymentLink?: string;
  customerName?: string;
  invoiceNumber?: string;
  amountDue?: string;
};

function TemplateBlock({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-zinc-500">{title}</p>
        <AdminZohoCopyLinkButton url={content} label="Copy" />
      </div>
      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-800">{content}</pre>
    </div>
  );
}

export function AdminZohoInvoiceMessageTemplates({
  paymentLink = "{{payment_link}}",
  customerName = "{{customer_name}}",
  invoiceNumber = "{{invoice_number}}",
  amountDue = "{{amount_due}}",
}: Props) {
  const [copiedSubject, setCopiedSubject] = useState(false);

  const note = fillZohoInvoiceMessageTemplate(ZOHO_INVOICE_NOTE_TEMPLATE, {
    paymentLink,
    customerName,
    invoiceNumber,
    amountDue,
  });

  const emailMessage = fillZohoInvoiceMessageTemplate(ZOHO_INVOICE_EMAIL_MESSAGE_TEMPLATE, {
    paymentLink,
    customerName,
    invoiceNumber,
    amountDue,
  });

  const copySubject = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ZOHO_INVOICE_EMAIL_SUBJECT_TEMPLATE);
      setCopiedSubject(true);
      window.setTimeout(() => setCopiedSubject(false), 2000);
    } catch {
      setCopiedSubject(false);
    }
  }, []);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Zoho note and customer message templates</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Copy these into Zoho invoice notes or your customer email/WhatsApp. Shalean does not send
          emails or write to Zoho automatically in this phase.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <TemplateBlock title="Suggested Zoho invoice note" content={note} />

        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-medium text-zinc-500">Suggested email subject</p>
            <button
              type="button"
              onClick={copySubject}
              className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              {copiedSubject ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-800">{ZOHO_INVOICE_EMAIL_SUBJECT_TEMPLATE}</p>
        </div>

        <TemplateBlock title="Suggested customer message" content={emailMessage} />
      </div>
    </section>
  );
}
