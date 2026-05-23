"use client";

import type { AdminBookingWizardFormState } from "../draftFormState";
import {
  buildAdminBookingSummaryLabels,
  formatAdminBookingSummaryExtras,
} from "../adminBookingSummaryDisplay";
import { composeAdminLocationNotes, composeAdminSpecialInstructions } from "../adminAddressCompose";
import { AdminBookingWizardPricingPreview } from "./AdminBookingWizardPricingPreview";

type Props = {
  form: AdminBookingWizardFormState;
  compact?: boolean;
};

export function AdminBookingWizardConfirmationReview({ form, compact = false }: Props) {
  const customer = form.selectedCustomer;
  const labels = buildAdminBookingSummaryLabels(form, null);
  const locationNotes = composeAdminLocationNotes(form);
  const specialInstructions = composeAdminSpecialInstructions(form);
  const extras = formatAdminBookingSummaryExtras(form);

  return (
    <div className="space-y-4" data-testid="admin-booking-confirmation-review">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</h3>
        <p className="mt-1 text-sm text-slate-900">{customer?.label ?? "Not selected"}</p>
        {customer ? (
          <p className="text-xs text-slate-500">
            {[customer.email, customer.phone].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service & extras</h3>
        <p className="mt-1 text-sm text-slate-900">{labels.serviceLabel}</p>
        <p className="text-xs capitalize text-slate-500">{labels.frequencyLabel}</p>
        {labels.recurringScheduleLabel !== "—" ? (
          <p
            className="mt-1 text-xs text-slate-600"
            data-testid="admin-booking-review-recurring-summary"
          >
            {labels.recurringScheduleLabel}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-slate-600" data-testid="admin-booking-review-extras">
          {extras}
        </p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</h3>
        <p className="mt-1 text-sm text-slate-900">{labels.scheduleLabel}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</h3>
        <p className="mt-1 text-sm text-slate-900">{labels.addressLabel}</p>
      </section>

      {(locationNotes || specialInstructions) && !compact ? (
        <section data-testid="admin-booking-review-notes">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Operational notes
          </h3>
          {locationNotes ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{locationNotes}</p>
          ) : null}
          {specialInstructions ? (
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{specialInstructions}</p>
          ) : null}
        </section>
      ) : null}

      {!compact ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote preview</h3>
          <div className="mt-2">
            <AdminBookingWizardPricingPreview form={form} />
          </div>
        </section>
      ) : null}

      {!compact ? (
        <section
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
          data-testid="admin-booking-audit-note"
        >
          <p className="font-medium text-slate-800">Admin audit</p>
          <p className="mt-1">
            Saving a draft records an entry in admin booking assist audit with your profile,
            customer, pricing snapshot, and idempotency key.
          </p>
        </section>
      ) : null}
    </div>
  );
}
