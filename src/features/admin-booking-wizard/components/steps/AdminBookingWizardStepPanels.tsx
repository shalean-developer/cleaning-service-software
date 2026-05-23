import type { ReactNode } from "react";
import type { AdminBookingWizardStep } from "../../types";
import { WIZARD_TEXT_MUTED, WIZARD_TEXT_PRIMARY } from "@/features/booking-wizard/wizardTheme";

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <h2 className={`text-lg font-semibold ${WIZARD_TEXT_PRIMARY}`}>{title}</h2>
      <p className={`mt-1 text-sm ${WIZARD_TEXT_MUTED}`}>{description}</p>
      {children ? <div className="mt-4 space-y-3">{children}</div> : null}
    </div>
  );
}

function PlaceholderField({ label }: { label: string }) {
  return (
    <div>
      <span className={`block text-xs font-medium ${WIZARD_TEXT_MUTED}`}>{label}</span>
      <div
        className="mt-1 min-h-10 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-400"
        aria-disabled="true"
      >
        Preview — not interactive in Phase 1
      </div>
    </div>
  );
}

type Props = {
  step: AdminBookingWizardStep;
};

export function AdminBookingWizardStepPanel({ step }: Props) {
  switch (step) {
    case "customer":
      return (
        <StepShell
          title="Customer"
          description="Search existing customers, create inline, duplicate detection, and customer notes."
        >
          <PlaceholderField label="Search customer" />
          <PlaceholderField label="Create customer inline" />
          <PlaceholderField label="Customer notes" />
        </StepShell>
      );
    case "service":
      return (
        <StepShell
          title="Service"
          description="Service type, extras, team support, frequency, and estimated duration."
        >
          <PlaceholderField label="Service type" />
          <PlaceholderField label="Add-ons" />
          <PlaceholderField label="Team support" />
          <PlaceholderField label="Frequency" />
        </StepShell>
      );
    case "schedule":
      return (
        <StepShell
          title="Schedule"
          description="Date, start time, recurring options, and availability validation."
        >
          <PlaceholderField label="Date" />
          <PlaceholderField label="Start time" />
          <PlaceholderField label="Recurring options" />
        </StepShell>
      );
    case "address":
      return (
        <StepShell
          title="Address"
          description="Suburb, city, access notes, and geolocation."
        >
          <PlaceholderField label="Street address" />
          <PlaceholderField label="Suburb / city" />
          <PlaceholderField label="Access notes" />
        </StepShell>
      );
    case "pricing":
      return (
        <StepShell
          title="Pricing"
          description="Canonical calculateQuote(), admin discounts, manual adjustments with audit trail, invoice preview."
        >
          <PlaceholderField label="Line items (server quote)" />
          <PlaceholderField label="Admin discount" />
          <PlaceholderField label="Invoice preview" />
        </StepShell>
      );
    case "payment":
      return (
        <StepShell
          title="Payment"
          description="Paystack link, EFT, cash, card machine, monthly invoice, or unpaid pending."
        >
          <PlaceholderField label="Payment rail" />
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Payment state: <strong className="text-slate-800">Not configured</strong> (read-only)
          </p>
        </StepShell>
      );
    case "review":
      return (
        <StepShell
          title="Review"
          description="Lifecycle preview, cleaner assignment preview, and customer notification preview."
        >
          <PlaceholderField label="Lifecycle preview" />
          <PlaceholderField label="Assignment preview" />
          <PlaceholderField label="Notifications preview" />
        </StepShell>
      );
    case "confirmation":
      return (
        <StepShell
          title="Confirmation"
          description="Create draft, unpaid booking, finalize paid booking, or send payment request — disabled in Phase 1."
        >
          <div className="flex flex-col gap-2" data-testid="admin-booking-confirmation-actions">
            <button
              type="button"
              disabled
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
            >
              Create unpaid booking
            </button>
            <button
              type="button"
              disabled
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
            >
              Finalize paid booking
            </button>
            <button
              type="button"
              disabled
              className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
            >
              Send payment request
            </button>
          </div>
        </StepShell>
      );
  }
}
