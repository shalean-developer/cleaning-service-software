"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import { PRICING_FREQUENCIES, type AddonSlug } from "@/features/pricing/server/types";
import { WIZARD_SERVICE_OPTIONS } from "../constants";
import { minBookableDateString } from "../slot";
import {
  createPaymentLock,
  fetchAvailableCleaners,
  fetchPricingQuote,
  initializePaystackCheckout,
} from "../api";
import { buildInitializeCheckoutPayload } from "../checkout";
import { buildLockRequestPayload, shouldReturnToReview } from "../lockPayload";
import { formatDateLabel, formatZar } from "../format";
import { nextStep, previousStep } from "../navigation";
import { clearWizardStorage, loadWizardState, saveWizardState } from "../storage";
import { INITIAL_WIZARD_STATE, type BookingWizardState } from "../types";
import { validateWizardStep } from "../validation";
import { WizardStepper } from "./WizardStepper";
import { WizardNav } from "./WizardNav";
import { Field, inputClass } from "./Field";

type Props = {
  customerEmail: string;
};

export function BookingWizard({ customerEmail }: Props) {
  const [state, setState] = useState<BookingWizardState>(INITIAL_WIZARD_STATE);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const checkoutLock = useRef(false);

  useEffect(() => {
    setState(loadWizardState());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    saveWizardState(state);
  }, [state]);

  const patch = useCallback((partial: Partial<BookingWizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
    setStepErrors({});
    setApiError(null);
  }, []);

  const minDate = useMemo(() => minBookableDateString(), []);

  const goNext = useCallback(async () => {
    const check = validateWizardStep(state.step, state);
    if (!check.valid) {
      setStepErrors(check.errors);
      return;
    }

    setStepErrors({});
    setApiError(null);

    if (state.step === "cleaner") {
      setLoading(true);
      const cleaners = await fetchAvailableCleaners(state);
      setLoading(false);
      if (!cleaners.ok) {
        setApiError(cleaners.message ?? cleaners.error);
        return;
      }
      patch({ availableCleaners: cleaners.cleaners });
    }

    if (state.step === "details") {
      const next = nextStep(state.step);
      if (next === "cleaner") {
        setLoading(true);
        const cleaners = await fetchAvailableCleaners(state);
        setLoading(false);
        if (!cleaners.ok) {
          setApiError(cleaners.message ?? cleaners.error);
          return;
        }
        patch({ step: next, availableCleaners: cleaners.cleaners });
        return;
      }
    }

    const nxt = nextStep(state.step);
    if (nxt) patch({ step: nxt });
  }, [state, patch]);

  const goBack = useCallback(() => {
    const prev = previousStep(state.step);
    if (prev) patch({ step: prev });
    setStepErrors({});
    setApiError(null);
  }, [state.step, patch]);

  const loadQuoteForReview = useCallback(async () => {
    setLoading(true);
    const quoteResult = await fetchPricingQuote(state);
    setLoading(false);
    if (!quoteResult.ok) {
      setApiError(quoteResult.message ?? quoteResult.error);
      return;
    }
    patch({ quote: quoteResult.quote });
  }, [state, patch]);

  useEffect(() => {
    if (state.step === "review" && !state.quote && !loading) {
      void loadQuoteForReview();
    }
  }, [state.step, state.quote, loading, loadQuoteForReview]);

  const handleCheckout = useCallback(async () => {
    if (checkoutLock.current || state.checkoutSubmitting) return;

    const check = validateWizardStep("checkout", state);
    if (!check.valid) {
      setStepErrors(check.errors);
      return;
    }

    if (!state.quote) {
      setApiError("Pricing quote is required before checkout.");
      return;
    }

    const email = customerEmail.trim();
    if (!email) {
      setApiError("A valid email is required for payment.");
      return;
    }

    const checkoutKey =
      state.checkoutIdempotencyKey ?? `checkout:${crypto.randomUUID()}`;
    if (!state.checkoutIdempotencyKey) {
      patch({ checkoutIdempotencyKey: checkoutKey });
    }

    const lockBody = buildLockRequestPayload(state, state.quote, checkoutKey);
    if ("error" in lockBody) {
      setApiError(lockBody.error);
      return;
    }

    checkoutLock.current = true;
    const attemptId = crypto.randomUUID();
    patch({ checkoutSubmitting: true, checkoutAttemptId: attemptId });

    const lockResult = await createPaymentLock(lockBody);

    if (!lockResult.ok) {
      patch({ checkoutSubmitting: false, checkoutAttemptId: null });
      checkoutLock.current = false;
      if (shouldReturnToReview(lockResult.error)) {
        setApiError(
          lockResult.message ??
            "Your quote is out of date. Review has been refreshed — please confirm again.",
        );
        patch({
          step: "review",
          quote: null,
          reviewConfirmed: false,
          lockId: null,
          lockedBookingId: null,
        });
        return;
      }
      setApiError(lockResult.message ?? lockResult.error);
      return;
    }

    const initPayload = buildInitializeCheckoutPayload(
      {
        bookingId: lockResult.bookingId,
        lockId: lockResult.lockId,
        paymentIdempotencyKey: lockResult.paymentIdempotencyKey,
        email,
      },
      state,
      state.quote,
    );

    if ("error" in initPayload) {
      patch({ checkoutSubmitting: false, checkoutAttemptId: null });
      checkoutLock.current = false;
      setApiError(initPayload.error);
      return;
    }

    const result = await initializePaystackCheckout(initPayload);

    if (!result.ok) {
      patch({ checkoutSubmitting: false, checkoutAttemptId: null });
      checkoutLock.current = false;
      if (shouldReturnToReview(result.error)) {
        setApiError(
          result.message ??
            "Checkout session expired or quote changed. Please review again.",
        );
        patch({
          step: "review",
          quote: null,
          reviewConfirmed: false,
          lockId: null,
          lockedBookingId: null,
        });
        return;
      }
      setApiError(result.message ?? result.error);
      return;
    }

    clearWizardStorage();
    window.location.href = result.authorization_url;
  }, [state, customerEmail, patch]);

  const serviceLabel =
    WIZARD_SERVICE_OPTIONS.find((s) => s.slug === state.serviceSlug)?.label ?? "—";

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-zinc-50 px-4 py-6 pb-24">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Book a clean</h1>
        <p className="text-sm text-zinc-600">Shalean Cleaning Services</p>
      </header>

      <WizardStepper current={state.step} />

      {apiError ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {apiError}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        {state.step === "service" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Choose a service</h2>
            <ul className="space-y-2">
              {WIZARD_SERVICE_OPTIONS.filter((s) => s.enabled).map((service) => (
                <li key={service.slug}>
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        serviceSlug: service.slug,
                        bedrooms: service.slug === "office-cleaning" ? 0 : 2,
                        bathrooms: service.slug === "office-cleaning" ? 0 : 1,
                      })
                    }
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      state.serviceSlug === service.slug
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400"
                    }`}
                  >
                    <span className="block font-medium">{service.label}</span>
                    <span
                      className={`mt-0.5 block text-xs ${
                        state.serviceSlug === service.slug
                          ? "text-zinc-300"
                          : "text-zinc-500"
                      }`}
                    >
                      {service.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {stepErrors.serviceSlug ? (
              <p className="mt-2 text-sm text-red-600">{stepErrors.serviceSlug}</p>
            ) : null}
          </div>
        ) : null}

        {state.step === "datetime" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Date &amp; time</h2>
            <p className="mb-4 text-sm text-zinc-600">
              Times are in Africa/Johannesburg (SAST, UTC+2).
            </p>
            <Field label="Date" error={stepErrors.date}>
              <input
                type="date"
                className={inputClass}
                min={minDate}
                value={state.date}
                onChange={(e) => patch({ date: e.target.value })}
              />
            </Field>
            <Field label="Start time" error={stepErrors.time}>
              <input
                type="time"
                className={inputClass}
                value={state.time}
                onChange={(e) => patch({ time: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {state.step === "location" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Location</h2>
            <Field label="Street address" error={stepErrors.addressLine1}>
              <input
                className={inputClass}
                value={state.addressLine1}
                onChange={(e) => patch({ addressLine1: e.target.value })}
                autoComplete="street-address"
              />
            </Field>
            <Field label="Suburb" error={stepErrors.suburb}>
              <input
                className={inputClass}
                value={state.suburb}
                onChange={(e) => patch({ suburb: e.target.value })}
              />
            </Field>
            <Field label="City" error={stepErrors.city}>
              <input
                className={inputClass}
                value={state.city}
                onChange={(e) => patch({ city: e.target.value })}
              />
            </Field>
            <Field label="Access notes (optional)">
              <textarea
                className={`${inputClass} min-h-[80px]`}
                value={state.locationNotes}
                onChange={(e) => patch({ locationNotes: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {state.step === "details" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Details &amp; add-ons</h2>
            {state.serviceSlug !== "office-cleaning" ? (
              <>
                <Field label="Bedrooms" error={stepErrors.bedrooms}>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className={inputClass}
                    value={state.bedrooms}
                    onChange={(e) => patch({ bedrooms: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Bathrooms" error={stepErrors.bathrooms}>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className={inputClass}
                    value={state.bathrooms}
                    onChange={(e) => patch({ bathrooms: Number(e.target.value) })}
                  />
                </Field>
              </>
            ) : (
              <Field label="Property size (sqm)" error={stepErrors.propertySizeSqm}>
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={state.propertySizeSqm ?? ""}
                  onChange={(e) =>
                    patch({
                      propertySizeSqm: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </Field>
            )}
            <Field label="Frequency">
              <select
                className={inputClass}
                value={state.frequency}
                onChange={(e) =>
                  patch({ frequency: e.target.value as BookingWizardState["frequency"] })
                }
              >
                {PRICING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-medium text-zinc-800">Add-ons</legend>
              <ul className="space-y-2">
                {(Object.keys(ADDON_CATALOG) as AddonSlug[]).map((slug) => (
                  <li key={slug}>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={state.addons.includes(slug)}
                        onChange={(e) => {
                          const addons = e.target.checked
                            ? [...state.addons, slug]
                            : state.addons.filter((a) => a !== slug);
                          patch({ addons });
                        }}
                      />
                      {ADDON_CATALOG[slug].label} ({formatZar(ADDON_CATALOG[slug].amountCents)})
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
            <Field label="Special instructions">
              <textarea
                className={`${inputClass} min-h-[80px]`}
                value={state.specialInstructions}
                onChange={(e) => patch({ specialInstructions: e.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {state.step === "cleaner" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Cleaner preference</h2>
            <button
              type="button"
              onClick={() =>
                patch({
                  cleanerPreferenceMode: "best_available",
                  selectedCleanerId: null,
                  selectedCleanerDisplayName: null,
                })
              }
              className={`mb-3 w-full rounded-xl border px-4 py-3 text-left ${
                state.cleanerPreferenceMode === "best_available"
                  ? "border-zinc-900 bg-zinc-50"
                  : "border-zinc-200"
              }`}
            >
              <span className="font-medium">Best available</span>
              <span className="mt-1 block text-xs text-zinc-600">
                We&apos;ll match the highest-rated eligible cleaner.
              </span>
            </button>
            {loading && state.availableCleaners.length === 0 ? (
              <p className="text-sm text-zinc-600">Loading cleaners…</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {state.availableCleaners.map((card) => {
                  const selected =
                    state.cleanerPreferenceMode === "selected" &&
                    state.selectedCleanerId === card.cleanerId;
                  const disabled = card.eligibilityStatus !== "eligible";
                  return (
                    <li key={card.cleanerId}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          patch({
                            cleanerPreferenceMode: "selected",
                            selectedCleanerId: card.cleanerId,
                            selectedCleanerDisplayName: card.displayName,
                          })
                        }
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                          selected
                            ? "border-zinc-900 bg-zinc-900 text-white"
                            : disabled
                              ? "cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400"
                              : "border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        <span className="font-medium">{card.displayName}</span>
                        {card.rating != null ? (
                          <span className="ml-2 text-xs">★ {card.rating.toFixed(1)}</span>
                        ) : null}
                        <span
                          className={`mt-1 block text-xs ${
                            selected ? "text-zinc-300" : "text-zinc-500"
                          }`}
                        >
                          {card.eligibilityReason}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {stepErrors.selectedCleanerId ? (
              <p className="mt-2 text-sm text-red-600">{stepErrors.selectedCleanerId}</p>
            ) : null}
          </div>
        ) : null}

        {state.step === "review" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Review</h2>
            {loading && !state.quote ? (
              <p className="text-sm text-zinc-600">Calculating price…</p>
            ) : state.quote ? (
              <>
                <dl className="mb-4 space-y-2 text-sm">
                  <div>
                    <dt className="text-zinc-500">Service</dt>
                    <dd className="font-medium">{serviceLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">When</dt>
                    <dd>{formatDateLabel(state.date, state.time)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Where</dt>
                    <dd>
                      {state.addressLine1}, {state.suburb}, {state.city}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">Cleaner</dt>
                    <dd>
                      {state.cleanerPreferenceMode === "best_available"
                        ? "Best available"
                        : state.selectedCleanerDisplayName ?? "Selected cleaner"}
                    </dd>
                  </div>
                </dl>
                <ul className="mb-4 border-t border-zinc-100 pt-3 text-sm">
                  {state.quote.lineItems.map((item) => (
                    <li
                      key={item.code}
                      className="flex justify-between gap-2 py-1 text-zinc-700"
                    >
                      <span>{item.label}</span>
                      <span>{formatZar(item.amountCents)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-semibold">
                  Total {formatZar(state.quote.totalCents)}
                </p>
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.reviewConfirmed}
                    onChange={(e) => patch({ reviewConfirmed: e.target.checked })}
                    className="mt-1"
                  />
                  <span>I confirm these details are correct.</span>
                </label>
                {stepErrors.reviewConfirmed ? (
                  <p className="mt-1 text-sm text-red-600">{stepErrors.reviewConfirmed}</p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {state.step === "checkout" ? (
          <div>
            <h2 className="mb-3 text-lg font-medium">Checkout</h2>
            <p className="mb-4 text-sm text-zinc-600">
              You&apos;ll be redirected to Paystack to pay securely. Your booking stays in
              <strong> pending payment</strong> until payment succeeds — it is never confirmed
              in the browser.
            </p>
            {state.quote ? (
              <p className="mb-4 text-2xl font-semibold">
                {formatZar(state.quote.totalCents)}
              </p>
            ) : null}
            <p className="text-sm text-zinc-600">
              Paying as <span className="font-medium text-zinc-900">{customerEmail}</span>
            </p>
          </div>
        ) : null}
      </div>

      <WizardNav
        showBack={state.step !== "service"}
        onBack={goBack}
        onContinue={
          state.step === "checkout"
            ? handleCheckout
            : state.step === "review"
              ? goNext
              : goNext
        }
        continueLabel={
          state.step === "checkout"
            ? "Pay with Paystack"
            : state.step === "review"
              ? "Continue to checkout"
              : "Continue"
        }
        loading={loading || state.checkoutSubmitting}
        continueDisabled={
          state.step === "checkout"
            ? state.checkoutSubmitting || !state.quote
            : false
        }
      />
    </div>
  );
}
