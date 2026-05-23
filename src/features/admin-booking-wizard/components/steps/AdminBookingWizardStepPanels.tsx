import type { ReactNode } from "react";
import { WIZARD_SERVICE_OPTIONS } from "@/features/booking-wizard/constants";
import { WIZARD_TEXT_MUTED, WIZARD_TEXT_PRIMARY } from "@/features/booking-wizard/wizardTheme";
import { PRICING_FREQUENCIES } from "@/features/pricing/server/types";
import type { AdminBookingWizardFormState } from "../../draftFormState";
import type { AdminBookingWizardStep } from "../../types";
import { AdminBookingWizardConfirmationActions } from "../AdminBookingWizardConfirmationActions";
import { AdminBookingWizardConfirmationReview } from "../AdminBookingWizardConfirmationReview";
import { AdminBookingWizardCustomerStep } from "../AdminBookingWizardCustomerStep";
import { AdminBookingWizardPricingPreview } from "../AdminBookingWizardPricingPreview";

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

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className={`block text-xs font-medium ${WIZARD_TEXT_MUTED}`}>{children}</span>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`mt-1 w-full min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ${props.className ?? ""}`}
    />
  );
}

type Props = {
  step: AdminBookingWizardStep;
  featureEnabled: boolean;
  paymentLinksEnabled: boolean;
  offlinePaymentsEnabled: boolean;
  form: AdminBookingWizardFormState;
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void;
};

export function AdminBookingWizardStepPanel({
  step,
  featureEnabled,
  paymentLinksEnabled,
  offlinePaymentsEnabled,
  form,
  onFormChange,
}: Props) {
  switch (step) {
    case "customer":
      return (
        <StepShell
          title="Customer"
          description="Search for an existing customer or create one inline. Required before saving a draft."
        >
          <AdminBookingWizardCustomerStep form={form} onFormChange={onFormChange} />
        </StepShell>
      );
    case "service":
      return (
        <StepShell title="Service" description="Service type and frequency for server-side pricing.">
          <label className="block">
            <FieldLabel>Service</FieldLabel>
            <select
              value={form.serviceSlug}
              onChange={(e) =>
                onFormChange({
                  serviceSlug: e.target.value as AdminBookingWizardFormState["serviceSlug"],
                })
              }
              className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select service</option>
              {WIZARD_SERVICE_OPTIONS.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Frequency</FieldLabel>
            <select
              value={form.frequency}
              onChange={(e) =>
                onFormChange({
                  frequency: e.target.value as AdminBookingWizardFormState["frequency"],
                })
              }
              className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {PRICING_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel>Bedrooms</FieldLabel>
              <TextInput
                type="number"
                min={0}
                max={20}
                value={form.bedrooms}
                onChange={(e) => onFormChange({ bedrooms: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <FieldLabel>Bathrooms</FieldLabel>
              <TextInput
                type="number"
                min={0}
                max={20}
                value={form.bathrooms}
                onChange={(e) => onFormChange({ bathrooms: Number(e.target.value) })}
              />
            </label>
          </div>
        </StepShell>
      );
    case "schedule":
      return (
        <StepShell title="Schedule" description="Visit date and start time (Africa/Johannesburg).">
          <label className="block">
            <FieldLabel>Date</FieldLabel>
            <TextInput
              type="date"
              value={form.date}
              onChange={(e) => onFormChange({ date: e.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Start time</FieldLabel>
            <TextInput
              type="time"
              value={form.time}
              onChange={(e) => onFormChange({ time: e.target.value })}
            />
          </label>
        </StepShell>
      );
    case "address":
      return (
        <StepShell title="Address" description="Service location for the booking record.">
          <label className="block">
            <FieldLabel>Street address</FieldLabel>
            <TextInput
              value={form.addressLine1}
              onChange={(e) => onFormChange({ addressLine1: e.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>Suburb</FieldLabel>
            <TextInput
              value={form.suburb}
              onChange={(e) => onFormChange({ suburb: e.target.value })}
            />
          </label>
          <label className="block">
            <FieldLabel>City</FieldLabel>
            <TextInput value={form.city} onChange={(e) => onFormChange({ city: e.target.value })} />
          </label>
        </StepShell>
      );
    case "pricing":
      return (
        <StepShell
          title="Pricing"
          description="Live quote preview from the server. Saving a draft recalculates pricing authoritatively."
        >
          <AdminBookingWizardPricingPreview form={form} />
        </StepShell>
      );
    case "payment":
      return (
        <StepShell
          title="Payment"
          description="Payment rails are disabled in Phase 2 (draft only)."
        >
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Payment state: <strong className="text-slate-800">Not configured</strong> — no payment
            link, EFT, or finalize actions in this phase.
          </p>
        </StepShell>
      );
    case "review":
      return (
        <StepShell
          title="Review"
          description="Confirm details, then save a draft on the next step when the feature flag is enabled."
        >
          <AdminBookingWizardConfirmationReview form={form} />
        </StepShell>
      );
    case "confirmation":
      return (
        <StepShell
          title="Confirmation"
          description="Save draft when enabled. Other actions remain disabled until later phases."
        >
          <AdminBookingWizardConfirmationReview form={form} />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <AdminBookingWizardConfirmationActions
              featureEnabled={featureEnabled}
              paymentLinksEnabled={paymentLinksEnabled}
              offlinePaymentsEnabled={offlinePaymentsEnabled}
              form={form}
            />
          </div>
        </StepShell>
      );
  }
}
