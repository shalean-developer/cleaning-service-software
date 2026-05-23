"use client";

import { useState } from "react";
import Link from "next/link";
import { ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_TEXT } from "@/features/zoho-invoice-payments/server/zohoInvoiceSavePaymentMethodConsent";
import { startZohoInvoicePaystackCheckout } from "./startZohoInvoicePaystackCheckout";

type ZohoInvoicePayButtonProps = {
  invoiceNumber: string;
  savedMethodsEnabled?: boolean;
};

export function ZohoInvoicePayButton({
  invoiceNumber,
  savedMethodsEnabled = true,
}: ZohoInvoicePayButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savePaymentMethodConsent, setSavePaymentMethodConsent] = useState(false);

  async function handlePayClick() {
    if (loading) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await startZohoInvoicePaystackCheckout(invoiceNumber, {
        savePaymentMethodConsent,
      });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      window.location.assign(result.authorizationUrl);
    } catch {
      setErrorMessage(
        "We could not start payment for this invoice. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-10 flex flex-col gap-4">
      {savedMethodsEnabled ? (
        <label className="flex items-start gap-3 rounded-xl border border-shalean-border bg-slate-50/80 p-4">
          <input
            type="checkbox"
            checked={savePaymentMethodConsent}
            onChange={(event) => setSavePaymentMethodConsent(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-shalean-primary focus:ring-shalean-primary"
          />
          <span className="text-sm leading-relaxed text-slate-700">
            {ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_TEXT}
          </span>
        </label>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handlePayClick}
          disabled={loading}
          className="marketing-focus-ring inline-flex w-full items-center justify-center rounded-xl bg-shalean-primary px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
        >
          {loading ? "Starting secure checkout…" : "Pay securely with Paystack"}
        </button>
        <Link
          href="/"
          className="text-center text-sm font-semibold text-shalean-primary hover:underline sm:text-left"
        >
          Back to Shalean home
        </Link>
      </div>
      {errorMessage ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <p className="text-xs text-slate-500">
        You will be redirected to Paystack to pay invoice {invoiceNumber}.
      </p>
    </div>
  );
}
