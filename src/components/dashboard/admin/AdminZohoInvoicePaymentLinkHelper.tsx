"use client";

import { useCallback, useState } from "react";
import { AdminZohoCopyLinkButton, AdminZohoOpenLinkButton } from "./AdminZohoPaymentLinkActions";

type LinkResult = {
  paymentLink: string;
  normalizedInvoiceNumber: string;
};

type CheckResult = {
  invoiceNumber: string;
  customerName: string | null;
  amountDueDisplay: string;
  currency: string;
  dueDate: string | null;
  status: string;
  canPayNow: boolean;
};

type Props = {
  initialInvoiceNumber?: string;
  onLinkGenerated?: (result: { paymentLink: string; normalizedInvoiceNumber: string }) => void;
  onInvoiceChecked?: (result: {
    invoiceNumber: string;
    customerName: string | null;
    amountDueDisplay: string;
    canPayNow: boolean;
  }) => void;
};

export function AdminZohoInvoicePaymentLinkHelper({
  initialInvoiceNumber = "",
  onLinkGenerated,
  onInvoiceChecked,
}: Props) {
  const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(false);

  const generateLink = useCallback(async () => {
    setLoadingLink(true);
    setLinkError(null);
    setLinkResult(null);
    try {
      const params = new URLSearchParams({ invoiceNumber: invoiceNumber.trim() });
      const response = await fetch(
        `/api/admin/zoho-invoice-payments/link-helper?${params.toString()}`,
      );
      const body = (await response.json()) as {
        ok: boolean;
        paymentLink?: string;
        normalizedInvoiceNumber?: string;
        message?: string;
      };
      if (!response.ok || !body.ok || !body.paymentLink || !body.normalizedInvoiceNumber) {
        setLinkError(body.message ?? "Could not generate payment link.");
        return;
      }
      setLinkResult({
        paymentLink: body.paymentLink,
        normalizedInvoiceNumber: body.normalizedInvoiceNumber,
      });
      onLinkGenerated?.({
        paymentLink: body.paymentLink,
        normalizedInvoiceNumber: body.normalizedInvoiceNumber,
      });
    } catch {
      setLinkError("Could not generate payment link.");
    } finally {
      setLoadingLink(false);
    }
  }, [invoiceNumber, onLinkGenerated]);

  const checkInvoice = useCallback(async () => {
    setLoadingCheck(true);
    setCheckError(null);
    setCheckResult(null);
    try {
      const params = new URLSearchParams({ invoiceNumber: invoiceNumber.trim() });
      const response = await fetch(
        `/api/admin/zoho-invoice-payments/check-invoice?${params.toString()}`,
      );
      const body = (await response.json()) as CheckResult & {
        ok: boolean;
        message?: string;
      };
      if (!response.ok || !body.ok) {
        setCheckError(body.message ?? "Could not check invoice.");
        return;
      }
      setCheckResult(body);
      onInvoiceChecked?.({
        invoiceNumber: body.invoiceNumber,
        customerName: body.customerName,
        amountDueDisplay: body.amountDueDisplay,
        canPayNow: body.canPayNow,
      });
    } catch {
      setCheckError("Could not check invoice.");
    } finally {
      setLoadingCheck(false);
    }
  }, [invoiceNumber, onInvoiceChecked]);

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Payment link helper</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Generate a branded Shalean payment link from a Zoho invoice number. No Zoho fetch is
          required to generate the link.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div>
          <label htmlFor="zoho-invoice-number" className="text-xs font-medium text-zinc-700">
            Invoice number
          </label>
          <input
            id="zoho-invoice-number"
            type="text"
            value={invoiceNumber}
            onChange={(event) => {
              setInvoiceNumber(event.target.value);
              setLinkResult(null);
              setCheckResult(null);
              setLinkError(null);
              setCheckError(null);
            }}
            placeholder="INV-001602"
            className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={generateLink}
            disabled={loadingLink || !invoiceNumber.trim()}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loadingLink ? "Generating…" : "Generate payment link"}
          </button>
          <button
            type="button"
            onClick={checkInvoice}
            disabled={loadingCheck || !invoiceNumber.trim()}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-50"
          >
            {loadingCheck ? "Checking…" : "Check invoice"}
          </button>
        </div>

        {linkError ? <p className="text-sm text-red-700">{linkError}</p> : null}

        {linkResult ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
            <p className="text-xs font-medium text-zinc-500">Generated link</p>
            <p className="mt-1 break-all font-mono text-sm text-zinc-900">{linkResult.paymentLink}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminZohoCopyLinkButton url={linkResult.paymentLink} />
              <AdminZohoOpenLinkButton url={linkResult.paymentLink} label="Open link" />
            </div>
          </div>
        ) : null}

        {checkError ? <p className="text-sm text-red-700">{checkError}</p> : null}

        {checkResult ? (
          <dl className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Invoice number</dt>
              <dd className="font-medium text-zinc-900">{checkResult.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Customer</dt>
              <dd className="font-medium text-zinc-900">{checkResult.customerName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Amount due</dt>
              <dd className="font-medium text-zinc-900">{checkResult.amountDueDisplay}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Status</dt>
              <dd className="font-medium text-zinc-900">{checkResult.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Due date</dt>
              <dd className="font-medium text-zinc-900">{checkResult.dueDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Can pay now</dt>
              <dd className="font-medium text-zinc-900">{checkResult.canPayNow ? "Yes" : "No"}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
