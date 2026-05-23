export const ZOHO_INVOICE_NOTE_TEMPLATE = `Pay securely online:
{{payment_link}}

Please use your invoice number as reference.`;

export const ZOHO_INVOICE_EMAIL_SUBJECT_TEMPLATE =
  "Invoice payment link from Shalean Cleaning Services";

export const ZOHO_INVOICE_EMAIL_MESSAGE_TEMPLATE = `Hello {{customer_name}},

Thank you for choosing Shalean Cleaning Services.

You can pay your invoice securely online using the link below:

{{payment_link}}

Invoice number: {{invoice_number}}
Amount due: {{amount_due}}

Once payment is complete, your invoice will be updated automatically.

Kind regards,
Shalean Cleaning Services`;

export function fillZohoInvoiceMessageTemplate(
  template: string,
  values: {
    paymentLink?: string;
    customerName?: string;
    invoiceNumber?: string;
    amountDue?: string;
  },
): string {
  return template
    .replaceAll("{{payment_link}}", values.paymentLink ?? "{{payment_link}}")
    .replaceAll("{{customer_name}}", values.customerName ?? "{{customer_name}}")
    .replaceAll("{{invoice_number}}", values.invoiceNumber ?? "{{invoice_number}}")
    .replaceAll("{{amount_due}}", values.amountDue ?? "{{amount_due}}");
}
