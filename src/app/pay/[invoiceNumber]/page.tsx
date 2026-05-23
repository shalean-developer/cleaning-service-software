import type { Metadata } from "next";
import Link from "next/link";
import { ShaleanLogo } from "@/components/marketing/ShaleanLogo";
import { MarketingContainer } from "@/components/marketing/MarketingContainer";
import { fetchZohoInvoicePaymentDetails } from "@/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentDetails";
import { ZohoInvoicePayButton } from "@/features/zoho-invoice-payments/client/ZohoInvoicePayButton";
import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import { validateAndNormalizeInvoiceNumber } from "@/features/zoho-invoice-payments/server/invoiceNumberValidation";
import type { ZohoInvoicePaymentPublicDto } from "@/features/zoho-invoice-payments/server/types";
import {
  isZohoInvoicePaymentsEnabled,
  isZohoSavedMethodsEnabled,
} from "@/features/zoho-invoice-payments/server/zohoPaymentLaunchGuard";

type PageProps = {
  params: Promise<{ invoiceNumber: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { invoiceNumber } = await params;
  const validated = validateAndNormalizeInvoiceNumber(invoiceNumber);
  const title = validated.ok
    ? `Pay invoice ${validated.normalized}`
    : "Pay invoice";
  return { title, description: "View and pay your Shalean invoice" };
}

function statusHeading(status: ZohoInvoicePaymentPublicDto["status"]): string {
  switch (status) {
    case "payable":
      return "Invoice payment";
    case "paid":
      return "Invoice already paid";
    case "void":
      return "Invoice unavailable";
    case "not_found":
      return "Invoice not found";
    case "not_configured":
      return "Online payment unavailable";
    case "error":
      return "Unable to load invoice";
    default:
      return "Invoice payment";
  }
}

function statusMessage(status: ZohoInvoicePaymentPublicDto["status"]): string {
  switch (status) {
    case "payable":
      return "Review your invoice details below, then pay securely with Paystack.";
    case "paid":
      return "This invoice has already been settled. No further payment is required.";
    case "void":
      return "This invoice is no longer available for payment.";
    case "not_found":
      return "We could not find an invoice matching this reference. Check the invoice number on your email or contact Shalean support.";
    case "not_configured":
      return "Online invoice payment is not available at the moment. Please use the payment details on your invoice or contact Shalean.";
    case "error":
      return "We could not load this invoice right now. Please try again later or contact Shalean support.";
    default:
      return "";
  }
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "—";
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return dueDate;
  return parsed.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function InvoiceStatusBadge({ status }: { status: ZohoInvoicePaymentPublicDto["status"] }) {
  const labels: Record<ZohoInvoicePaymentPublicDto["status"], string> = {
    payable: "Payment due",
    paid: "Paid",
    void: "Cancelled",
    not_found: "Not found",
    error: "Unavailable",
    not_configured: "Unavailable",
  };

  const styles: Record<ZohoInvoicePaymentPublicDto["status"], string> = {
    payable: "bg-amber-50 text-amber-900 ring-amber-200",
    paid: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    void: "bg-slate-100 text-slate-700 ring-slate-200",
    not_found: "bg-slate-100 text-slate-700 ring-slate-200",
    error: "bg-slate-100 text-slate-700 ring-slate-200",
    not_configured: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export default async function PayInvoicePage({ params }: PageProps) {
  const { invoiceNumber } = await params;
  const validated = validateAndNormalizeInvoiceNumber(invoiceNumber);

  if (!validated.ok) {
    return (
      <PayInvoiceShell>
        <PayInvoiceCard>
          <h1 className="text-2xl font-bold tracking-tight text-shalean-navy sm:text-3xl">
            Invalid invoice reference
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            The invoice number in this link does not look valid. Check the link from your
            invoice email or contact Shalean support.
          </p>
          <PayInvoiceFooterActions showPayButton={false} />
        </PayInvoiceCard>
      </PayInvoiceShell>
    );
  }

  if (!isZohoInvoicePaymentsEnabled()) {
    return (
      <PayInvoiceShell>
        <PayInvoiceCard>
          <InvoicePageHeader status="not_configured" invoiceNumber={validated.normalized} />
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Online invoice payments are temporarily unavailable. Please use the payment details on
            your invoice or contact Shalean support.
          </p>
          <PayInvoiceFooterActions showPayButton={false} />
        </PayInvoiceCard>
      </PayInvoiceShell>
    );
  }

  const result = await fetchZohoInvoicePaymentDetails(invoiceNumber);

  if (!result.ok) {
    const failureStatus = "code" in result ? ("error" as const) : result.status;
    const failureMessage =
      "code" in result
        ? "We could not load this invoice right now. Please try again later or contact Shalean support."
        : result.message;

    return (
      <PayInvoiceShell>
        <PayInvoiceCard>
          <InvoicePageHeader status={failureStatus} invoiceNumber={validated.normalized} />
          <p className="mt-4 text-base leading-relaxed text-slate-600">{failureMessage}</p>
          <PayInvoiceFooterActions showPayButton={false} />
        </PayInvoiceCard>
      </PayInvoiceShell>
    );
  }

  const invoice = result.invoice;
  const showDetails =
    invoice.status === "payable" || invoice.status === "paid" || invoice.status === "void";
  const showPayButton = invoice.status === "payable";

  return (
    <PayInvoiceShell>
      <PayInvoiceCard>
        <InvoicePageHeader status={invoice.status} invoiceNumber={invoice.invoiceNumber} />
        <p className="mt-4 text-base leading-relaxed text-slate-600">
          {statusMessage(invoice.status)}
        </p>

        {showDetails ? (
          <div className="mt-8 space-y-6 border-t border-shalean-border pt-8">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-slate-500">Invoice number</dt>
                <dd className="mt-1 text-base font-semibold text-shalean-navy">
                  {invoice.invoiceNumber}
                </dd>
              </div>
              {invoice.customerName ? (
                <div>
                  <dt className="text-sm font-medium text-slate-500">Customer</dt>
                  <dd className="mt-1 text-base font-semibold text-shalean-navy">
                    {invoice.customerName}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-sm font-medium text-slate-500">Amount due</dt>
                <dd className="mt-1 text-base font-semibold text-shalean-navy">
                  {formatInvoiceAmount(invoice.amountDueCents, invoice.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-500">Due date</dt>
                <dd className="mt-1 text-base font-semibold text-shalean-navy">
                  {formatDueDate(invoice.dueDate)}
                </dd>
              </div>
            </dl>

            {invoice.lineItems.length > 0 ? (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Line items
                </h2>
                <ul className="mt-3 divide-y divide-shalean-border rounded-xl border border-shalean-border">
                  {invoice.lineItems.map((item, index) => (
                    <li
                      key={`${item.name}-${index}`}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-shalean-navy">{item.name}</p>
                        {item.quantity != null ? (
                          <p className="text-sm text-slate-500">Qty {item.quantity}</p>
                        ) : null}
                      </div>
                      {item.totalCents != null ? (
                        <p className="text-sm font-semibold text-shalean-navy">
                          {formatInvoiceAmount(item.totalCents, invoice.currency)}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {showPayButton ? (
          <ZohoInvoicePayButton
            invoiceNumber={invoice.invoiceNumber}
            savedMethodsEnabled={isZohoSavedMethodsEnabled()}
          />
        ) : (
          <PayInvoiceFooterActions showPayButton={false} />
        )}
      </PayInvoiceCard>
    </PayInvoiceShell>
  );
}

function InvoicePageHeader({
  status,
  invoiceNumber,
}: {
  status: ZohoInvoicePaymentPublicDto["status"];
  invoiceNumber: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Shalean invoice
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-shalean-navy sm:text-3xl">
          {statusHeading(status)}
        </h1>
      </div>
      <InvoiceStatusBadge status={status} />
    </div>
  );
}

function PayInvoiceShell({ children }: { children: React.ReactNode }) {
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
        <MarketingContainer className="w-full">{children}</MarketingContainer>
      </main>
    </div>
  );
}

function PayInvoiceCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-shalean-border bg-white p-6 shadow-lg shadow-slate-200/50 sm:p-10">
      {children}
    </div>
  );
}

function PayInvoiceFooterActions({ showPayButton }: { showPayButton: boolean }) {
  return (
    <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
      <button
        type="button"
        disabled
        className="marketing-focus-ring inline-flex w-full items-center justify-center rounded-xl bg-shalean-primary px-6 py-3 text-sm font-bold text-white opacity-60 sm:w-auto"
        aria-disabled="true"
      >
        {showPayButton ? "Pay securely with Paystack" : "Online payment coming soon"}
      </button>
      <Link
        href="/"
        className="text-center text-sm font-semibold text-shalean-primary hover:underline sm:text-left"
      >
        Back to Shalean home
      </Link>
    </div>
  );
}
