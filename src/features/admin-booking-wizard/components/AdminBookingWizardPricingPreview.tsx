"use client";

import { useEffect, useState } from "react";
import type { PricingBreakdown } from "@/features/pricing/server/types";
import { TEAM_SUPPORT_STEP_OPTIONS } from "@/features/booking-wizard/constants";
import type { AdminBookingWizardFormState } from "../draftFormState";
import { buildAdminDraftPricingInput } from "../adminPricingInput";
import { formatAdminBookingSummaryExtras } from "../adminBookingSummaryDisplay";
import { fetchAdminDraftPricingQuote, formatAdminQuoteZar } from "../pricingApi";
import { WIZARD_SERVICE_OPTIONS } from "@/features/booking-wizard/constants";

type Props = {
  form: AdminBookingWizardFormState;
};

function serviceLabel(slug: string): string {
  return WIZARD_SERVICE_OPTIONS.find((opt) => opt.slug === slug)?.label ?? slug;
}

export function AdminBookingWizardPricingPreview({ form }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<PricingBreakdown | null>(null);

  const pricingInput = buildAdminDraftPricingInput(form);
  const pricingKey = pricingInput ? JSON.stringify(pricingInput) : "";

  useEffect(() => {
    if (!pricingKey) {
      setQuote(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchAdminDraftPricingQuote(form).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setQuote(null);
        setError(result.message);
        return;
      }
      setQuote(result.quote);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [form, pricingKey]);

  if (!form.serviceSlug) {
    return (
      <p className="text-sm text-slate-600" data-testid="admin-booking-pricing-empty">
        Select a service on step 2 to preview pricing.
      </p>
    );
  }

  const teamLabel =
    form.serviceSlug === "regular-cleaning" && form.requestedTeamSize === 2
      ? (TEAM_SUPPORT_STEP_OPTIONS.find((o) => o.value === 2)?.label ?? "Team of 2")
      : "Single cleaner";

  return (
    <div data-testid="admin-booking-pricing-preview">
      <dl className="mb-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Service</dt>
          <dd>{serviceLabel(form.serviceSlug)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Frequency</dt>
          <dd className="capitalize">{form.frequency.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Home size</dt>
          <dd>
            {form.bedrooms} bed · {form.bathrooms} bath
            {form.extraRooms > 0 ? ` · ${form.extraRooms} extra` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Team</dt>
          <dd>{teamLabel}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Extras</dt>
          <dd>{formatAdminBookingSummaryExtras(form)}</dd>
        </div>
      </dl>

      {loading ? (
        <p className="text-sm text-slate-500" data-testid="admin-booking-pricing-loading">
          Loading quote…
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert" data-testid="admin-booking-pricing-error">
          {error}
        </p>
      ) : null}

      {quote ? (
        <section aria-label="Price breakdown">
          <ul className="divide-y divide-slate-100 text-sm">
            {quote.lineItems.map((item) => (
              <li key={item.code} className="flex justify-between gap-3 py-1.5 text-slate-600">
                <span>{item.label}</span>
                <span className="tabular-nums font-medium">{formatAdminQuoteZar(item.amountCents)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Total (advisory)</span>
            <span data-testid="admin-booking-pricing-total">{formatAdminQuoteZar(quote.totalCents)}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Preview only. The server recalculates the canonical quote when you save the draft.
          </p>
        </section>
      ) : null}
    </div>
  );
}
