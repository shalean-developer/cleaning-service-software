export type StartZohoInvoicePaystackCheckoutOptions = {
  savePaymentMethodConsent?: boolean;
};

export type StartZohoInvoicePaystackCheckoutResult =
  | { ok: true; authorizationUrl: string }
  | { ok: false; message: string };

export async function startZohoInvoicePaystackCheckout(
  invoiceNumber: string,
  options: StartZohoInvoicePaystackCheckoutOptions = {},
): Promise<StartZohoInvoicePaystackCheckoutResult> {
  const response = await fetch("/api/paystack/initialize-zoho-invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      invoiceNumber,
      savePaymentMethodConsent: options.savePaymentMethodConsent === true,
    }),
  });

  const data: unknown = await response.json().catch(() => ({}));
  const record = data as Record<string, unknown>;

  if (!response.ok || record.ok !== true) {
    const message =
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : "We could not start payment for this invoice. Please try again later.";
    return { ok: false, message };
  }

  const authorizationUrl =
    typeof record.authorizationUrl === "string" ? record.authorizationUrl.trim() : "";

  if (!authorizationUrl) {
    return {
      ok: false,
      message: "We could not start payment for this invoice. Please try again later.",
    };
  }

  return { ok: true, authorizationUrl };
}
