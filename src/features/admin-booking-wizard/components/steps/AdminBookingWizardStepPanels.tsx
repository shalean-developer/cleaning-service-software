import type { ReactNode } from "react";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { WIZARD_SERVICE_OPTIONS } from "@/features/booking-wizard/constants";
import { WIZARD_TEXT_MUTED, WIZARD_TEXT_PRIMARY } from "@/features/booking-wizard/wizardTheme";
import { PRICING_FREQUENCIES } from "@/features/pricing/server/types";
import {
  resolveAdminScheduleBounds,
  resolveAdminScheduleHelperCopy,
  validateAdminSchedule,
} from "../../adminScheduleValidation";
import { applyAdminServiceSelection } from "../../adminServiceSelection";
import type { AdminBookingFlowSnapshot } from "../../adminBookingFlowState";
import type { AdminBookingWizardFormState } from "../../draftFormState";
import type { AdminBookingWizardStep } from "../../types";
import { AdminBookingWizardConfirmationActions } from "../AdminBookingWizardConfirmationActions";
import { AdminBookingWizardConfirmationChecklist } from "../AdminBookingWizardConfirmationChecklist";
import { AdminBookingWizardConfirmationReview } from "../AdminBookingWizardConfirmationReview";
import { AdminBookingWizardCustomerStep } from "../AdminBookingWizardCustomerStep";
import { AdminBookingWizardPaymentStepPanel } from "../AdminBookingWizardPaymentStepPanel";
import { AdminBookingWizardPricingPreview } from "../AdminBookingWizardPricingPreview";
import { AdminBookingWizardServiceDetailsSection } from "../AdminBookingWizardServiceDetailsSection";
import { AdminBookingWizardOfflinePaymentHandoff } from "../AdminBookingWizardOfflinePaymentHandoff";
import { AdminBookingWizardRecoveryPanel } from "../AdminBookingWizardRecoveryPanel";
import { deriveAdminBookingFlowProgress } from "../../adminBookingFlowState";

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

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={props.rows ?? 2}
      className={`mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 ${props.className ?? ""}`}
    />
  );
}

type Props = {
  step: AdminBookingWizardStep;
  featureEnabled: boolean;
  paymentLinksEnabled: boolean;
  offlinePaymentsEnabled: boolean;
  form: AdminBookingWizardFormState;
  flow: AdminBookingFlowSnapshot;
  customerPrefillLoading?: boolean;
  customerPrefillError?: string | null;
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void;
  onFlowChange: (flow: AdminBookingFlowSnapshot) => void;
  onFlowRefresh: () => Promise<void>;
};

export function AdminBookingWizardStepPanel({
  step,
  featureEnabled,
  paymentLinksEnabled,
  offlinePaymentsEnabled,
  form,
  flow,
  customerPrefillLoading,
  customerPrefillError,
  onFormChange,
  onFlowChange,
  onFlowRefresh,
}: Props) {
  const scheduleBounds = resolveAdminScheduleBounds();
  const scheduleValidation = validateAdminSchedule(form.date, form.time);
  const scheduleHelper = resolveAdminScheduleHelperCopy();

  switch (step) {
    case "customer":
      return (
        <StepShell
          title="Customer"
          description="Search for an existing customer or create one inline. Required before saving a draft."
        >
          <AdminBookingWizardCustomerStep
            form={form}
            onFormChange={onFormChange}
            prefillLoading={customerPrefillLoading}
            prefillError={customerPrefillError}
          />
        </StepShell>
      );
    case "service":
      return (
        <StepShell
          title="Service"
          description="Service type, frequency, and pricing inputs aligned with the customer booking wizard."
        >
          <label className="block">
            <FieldLabel>Service</FieldLabel>
            <select
              value={form.serviceSlug}
              onChange={(e) => {
                const slug = e.target.value as ServiceSlug | "";
                if (!slug) {
                  onFormChange({ serviceSlug: "" });
                  return;
                }
                onFormChange(applyAdminServiceSelection(form, slug));
              }}
              className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              data-testid="admin-booking-service-select"
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
                  {f.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <AdminBookingWizardServiceDetailsSection form={form} onFormChange={onFormChange} />
        </StepShell>
      );
    case "schedule":
      return (
        <StepShell
          title="Schedule"
          description={`Visit date and start time. ${scheduleHelper}`}
        >
          <label className="block">
            <FieldLabel>Date</FieldLabel>
            <TextInput
              type="date"
              min={scheduleBounds.minDate}
              max={scheduleBounds.maxDate}
              value={form.date}
              onChange={(e) => onFormChange({ date: e.target.value })}
              data-testid="admin-booking-schedule-date"
            />
          </label>
          <label className="block">
            <FieldLabel>Start time</FieldLabel>
            <TextInput
              type="time"
              value={form.time}
              onChange={(e) => onFormChange({ time: e.target.value })}
              data-testid="admin-booking-schedule-time"
            />
          </label>
          <p className="text-xs text-slate-500" data-testid="admin-booking-schedule-helper">
            {scheduleHelper}
          </p>
          {!scheduleValidation.valid && form.date && form.time ? (
            <p
              className="text-sm text-red-700"
              role="alert"
              data-testid="admin-booking-schedule-error"
            >
              {scheduleValidation.message}
            </p>
          ) : null}
        </StepShell>
      );
    case "address":
      return (
        <StepShell
          title="Address & access"
          description="Service location and operational notes for cleaners and dispatch."
        >
          <label className="block">
            <FieldLabel>Street address</FieldLabel>
            <TextInput
              value={form.addressLine1}
              onChange={(e) => onFormChange({ addressLine1: e.target.value })}
              data-testid="admin-booking-address-line1"
            />
          </label>
          <label className="block">
            <FieldLabel>Suburb</FieldLabel>
            <TextInput
              value={form.suburb}
              onChange={(e) => onFormChange({ suburb: e.target.value })}
              data-testid="admin-booking-address-suburb"
            />
          </label>
          <label className="block">
            <FieldLabel>City</FieldLabel>
            <TextInput
              value={form.city}
              onChange={(e) => onFormChange({ city: e.target.value })}
              data-testid="admin-booking-address-city"
            />
          </label>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Operational notes (optional)
            </p>
            <div className="mt-2 space-y-3">
              <label className="block">
                <FieldLabel>Access instructions</FieldLabel>
                <TextArea
                  value={form.accessInstructions}
                  onChange={(e) => onFormChange({ accessInstructions: e.target.value })}
                  data-testid="admin-booking-access-instructions"
                />
              </label>
              <label className="block">
                <FieldLabel>Gate / intercom code</FieldLabel>
                <TextInput
                  value={form.gateCode}
                  onChange={(e) => onFormChange({ gateCode: e.target.value })}
                  data-testid="admin-booking-gate-code"
                />
              </label>
              <label className="block">
                <FieldLabel>Parking instructions</FieldLabel>
                <TextArea
                  value={form.parkingInstructions}
                  onChange={(e) => onFormChange({ parkingInstructions: e.target.value })}
                  data-testid="admin-booking-parking-instructions"
                />
              </label>
              <label className="block">
                <FieldLabel>Location notes</FieldLabel>
                <TextArea
                  value={form.locationNotes}
                  onChange={(e) => onFormChange({ locationNotes: e.target.value })}
                  data-testid="admin-booking-location-notes"
                />
              </label>
              <label className="block">
                <FieldLabel>Pet notes</FieldLabel>
                <TextArea
                  value={form.petNotes}
                  onChange={(e) => onFormChange({ petNotes: e.target.value })}
                  data-testid="admin-booking-pet-notes"
                />
              </label>
              <label className="block">
                <FieldLabel>Special instructions</FieldLabel>
                <TextArea
                  value={form.specialInstructions}
                  onChange={(e) => onFormChange({ specialInstructions: e.target.value })}
                  data-testid="admin-booking-special-instructions"
                />
              </label>
            </div>
          </div>
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
    case "payment": {
      const pendingBookingId = flow.pendingPayment?.bookingId ?? flow.saved?.bookingId;
      return (
        <StepShell
          title="Payment"
          description="How admin-assisted bookings move from draft to confirmed payment."
        >
          <AdminBookingWizardPaymentStepPanel
            featureEnabled={featureEnabled}
            paymentLinksEnabled={paymentLinksEnabled}
            offlinePaymentsEnabled={offlinePaymentsEnabled}
            flow={flow}
          />
          {pendingBookingId &&
          (flow.pendingPayment?.bookingId || flow.serverStatus?.status === "pending_payment") ? (
            <AdminBookingWizardOfflinePaymentHandoff
              bookingId={pendingBookingId}
              offlinePaymentsEnabled={offlinePaymentsEnabled}
            />
          ) : null}
        </StepShell>
      );
    }
    case "review":
      return (
        <StepShell
          title="Review"
          description="Confirm customer, schedule, pricing inputs, and operational notes before payment actions."
        >
          <AdminBookingWizardConfirmationReview form={form} />
        </StepShell>
      );
    case "confirmation": {
      const progress = deriveAdminBookingFlowProgress(flow);
      const pendingBookingId = flow.pendingPayment?.bookingId ?? flow.saved?.bookingId;
      return (
        <StepShell
          title="Confirmation"
          description="Save draft, create pending payment, then generate and share a payment link."
        >
          <AdminBookingWizardConfirmationChecklist
            progress={progress}
            serverStatusLabel={flow.serverStatus?.status.replace(/_/g, " ") ?? null}
          />
          <div className="mt-4">
            <AdminBookingWizardConfirmationReview form={form} compact />
          </div>
          {pendingBookingId &&
          (flow.pendingPayment?.bookingId || flow.serverStatus?.status === "pending_payment") ? (
            <AdminBookingWizardOfflinePaymentHandoff
              bookingId={pendingBookingId}
              offlinePaymentsEnabled={offlinePaymentsEnabled}
            />
          ) : null}
          <AdminBookingWizardRecoveryPanel
            paymentLinksEnabled={paymentLinksEnabled}
            form={form}
            flow={flow}
            onFlowChange={onFlowChange}
            onFlowRefresh={onFlowRefresh}
          />
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div
              className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
              data-testid="admin-booking-confirmation-mobile-footer"
            >
              <AdminBookingWizardConfirmationActions
                featureEnabled={featureEnabled}
                paymentLinksEnabled={paymentLinksEnabled}
                offlinePaymentsEnabled={offlinePaymentsEnabled}
                form={form}
                flow={flow}
                onFlowChange={onFlowChange}
                onFlowRefresh={onFlowRefresh}
              />
            </div>
          </div>
        </StepShell>
      );
    }
  }
}
