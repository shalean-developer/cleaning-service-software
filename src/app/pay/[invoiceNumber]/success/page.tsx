import type { Metadata } from "next";
import Link from "next/link";
import { ShaleanLogo } from "@/components/marketing/ShaleanLogo";
import { MarketingContainer } from "@/components/marketing/MarketingContainer";
import { validateAndNormalizeInvoiceNumber } from "@/features/zoho-invoice-payments/server/invoiceNumberValidation";
import { fetchZohoInvoicePaymentStatusByReference } from "@/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentStatusByReference";
import { resolvePaystackReference } from "@/lib/app/paymentReturn";

type PageProps = {
  params: Promise<{ invoiceNumber: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { invoiceNumber } = await params;
  const validated = validateAndNormalizeInvoiceNumber(invoiceNumber);
  const title = validated.ok
    ? `Payment status — ${validated.normalized}`
    : "Payment status";
  return { title, description: "Paystack payment status for your Shalean invoice" };
}

function statusHeading(status: string | null): string {
  switch (status) {
    case "paid":
      return "Payment successful";
    case "failed":
      return "Payment not successful";
    case "zoho_reconcile_pending":
    case "pending_paystack":
      return "Payment received";
    case "zoho_reconcile_failed":
    case "unknown":
      return "Payment status unavailable";
    default:
      return "Payment received by Paystack";
  }
}

export default async function PayInvoiceSuccessPage({ params, searchParams }: PageProps) {
  const { invoiceNumber } = await params;
  const query = await searchParams;
  const validated = validateAndNormalizeInvoiceNumber(invoiceNumber);
  const displayInvoiceNumber = validated.ok ? validated.normalized : invoiceNumber.trim();

  const reference = resolvePaystackReference({
    get: (key: string) => {
      const value = query[key];
      if (Array.isArray(value)) return value[0] ?? null;
      return value ?? null;
    },
  });

  const statusResult = reference
    ? await fetchZohoInvoicePaymentStatusByReference(reference)
    : null;

  const statusMessage =
    statusResult?.ok === true
      ? statusResult.message
      : "Payment received by Paystack. We are finalising invoice reconciliation.";

  const saveMethodMessage =
    statusResult?.ok === true ? statusResult.saveMethodMessage : null;

  const heading = statusResult?.ok === true ? statusHeading(statusResult.status) : statusHeading(null);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-shalean-soft-blue/40 to-white">
      <header className="border-b border-shalean-border/60 bg-white/80 backdrop-blur-sm">
        <MarketingContainer className="flex items-center justify-between py-4">
          <ShaleanLogo variant="header" />
          <Link
            href="/contact"
            className="text-sm font-semibold text-shalean-primary hover:underline"
          >
            Contact support
          </Link>
        </MarketingContainer>
      </header>
      <main className="flex flex-1 items-center py-10 sm:py-14">
        <MarketingContainer className="w-full">
          <div className="mx-auto max-w-2xl rounded-2xl border border-shalean-border bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-10">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Shalean invoice payment
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-shalean-navy sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">{statusMessage}</p>
            {saveMethodMessage ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{saveMethodMessage}</p>
            ) : null}
            <dl className="mt-8 space-y-4 border-t border-shalean-border pt-8">
              <div>
                <dt className="text-sm font-medium text-slate-500">Invoice number</dt>
                <dd className="mt-1 text-base font-semibold text-shalean-navy">
                  {displayInvoiceNumber}
                </dd>
              </div>
              {reference ? (
                <div>
                  <dt className="text-sm font-medium text-slate-500">Payment reference</dt>
                  <dd className="mt-1 break-all text-base font-semibold text-shalean-navy">
                    {reference}
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={`/pay/${encodeURIComponent(displayInvoiceNumber)}`}
                className="marketing-focus-ring inline-flex items-center justify-center rounded-xl bg-shalean-primary px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-600"
              >
                Back to invoice
              </Link>
              <Link
                href="/"
                className="text-center text-sm font-semibold text-shalean-primary hover:underline sm:text-left"
              >
                Back to Shalean home
              </Link>
            </div>
          </div>
        </MarketingContainer>
      </main>
    </div>
  );
}
