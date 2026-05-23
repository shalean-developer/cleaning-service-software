"use client";

import { WIZARD_SERVICE_OPTIONS } from "@/features/booking-wizard/constants";
import type { AdminBookingWizardFormState } from "../draftFormState";
import { AdminBookingWizardPricingPreview } from "./AdminBookingWizardPricingPreview";

type Props = {
  form: AdminBookingWizardFormState;
};

function serviceLabel(slug: string): string {
  return WIZARD_SERVICE_OPTIONS.find((opt) => opt.slug === slug)?.label ?? slug;
}

export function AdminBookingWizardConfirmationReview({ form }: Props) {
  const customer = form.selectedCustomer;
  const address =
    form.addressLine1 && form.suburb && form.city
      ? `${form.addressLine1}, ${form.suburb}, ${form.city}`
      : "—";
  const schedule =
    form.date && form.time ? `${form.date} · ${form.time}` : "—";

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
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</h3>
        <p className="mt-1 text-sm text-slate-900">{schedule}</p>
        <p className="text-xs text-slate-500">{serviceLabel(form.serviceSlug || "")}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Address</h3>
        <p className="mt-1 text-sm text-slate-900">{address}</p>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote preview</h3>
        <div className="mt-2">
          <AdminBookingWizardPricingPreview form={form} />
        </div>
      </section>

      <section
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
        data-testid="admin-booking-audit-note"
      >
        <p className="font-medium text-slate-800">Admin audit</p>
        <p className="mt-1">
          Saving a draft records an entry in <code>admin_booking_assist_audit</code> with your
          profile, customer, pricing snapshot, and idempotency key. No payment or assignment
          lifecycle runs in this phase.
        </p>
      </section>
    </div>
  );
}
