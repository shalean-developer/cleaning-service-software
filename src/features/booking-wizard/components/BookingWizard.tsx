"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ServiceSlug } from "@/features/pricing/server/types";
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
import { nextStep, previousStep } from "../navigation";
import { clearWizardStorage, loadWizardState, saveWizardState } from "../storage";
import { initialContactPhoneField } from "../contactPhone";
import { wizardPatchForServiceSelection } from "../serviceSelection";
import { INITIAL_WIZARD_STATE, type BookingWizardState } from "../types";
import { validateWizardStep } from "../validation";
import {
  getWizardCardClass,
  getWizardNavClass,
  getWizardShellClass,
  WIZARD_MAIN_COLUMN_CLASS,
  WIZARD_MOBILE_STICKY_FOOTER_CLASS,
  WIZARD_STICKY_FOOTER_INNER_CLASS,
} from "../wizardLayout";
import { WizardStepper } from "./WizardStepper";
import { WizardNav } from "./WizardNav";
import { Field, inputClass } from "./Field";
import { AddonsStepPanel } from "./AddonsStepPanel";
import { CheckoutStepPanel } from "./CheckoutStepPanel";
import { CleanerStepPanel } from "./CleanerStepPanel";
import { CleaningIntensityStepPanel } from "./CleaningIntensityStepPanel";
import { EquipmentSupplyStepPanel } from "./EquipmentSupplyStepPanel";
import { TeamSupportStepPanel } from "./TeamSupportStepPanel";
import { FrequencyStepPanel } from "./FrequencyStepPanel";
import { ReviewStepPanel } from "./ReviewStepPanel";
import { ScheduleStepPanel } from "./ScheduleStepPanel";
import { ServiceStepPanel } from "./ServiceStepPanel";
import { WizardContextStrip } from "./WizardContextStrip";
import {
  CheckoutMobileCommerceSummary,
  ReviewMobileCommerceSummary,
} from "./WizardMobileCommerceSummary";
import { WizardMobileStickyFooter } from "./WizardMobileStickyFooter";
import { WizardStepHeading } from "./WizardStepHeading";

type Props = {
  customerEmail: string;
  initialServiceSlug?: ServiceSlug;
  initialCustomerPhone?: string | null;
};

export function BookingWizard({
  customerEmail,
  initialServiceSlug,
  initialCustomerPhone = null,
}: Props) {
  const [state, setState] = useState<BookingWizardState>(INITIAL_WIZARD_STATE);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const checkoutLock = useRef(false);

  useEffect(() => {
    const loaded = loadWizardState();
    const profilePhone = initialCustomerPhone?.trim() || null;
    const withPhone = {
      ...loaded,
      profilePhone,
      contactPhone: initialContactPhoneField(loaded.contactPhone, profilePhone),
    };
    if (initialServiceSlug) {
      setState({ ...withPhone, ...wizardPatchForServiceSelection(initialServiceSlug) });
    } else {
      setState(withPhone);
    }
    hydrated.current = true;
  }, [initialServiceSlug, initialCustomerPhone]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveWizardState(state);
  }, [state]);

  const patch = useCallback((partial: Partial<BookingWizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
    setStepErrors({});
    setApiError(null);
  }, []);

  const handleSelectService = useCallback(
    (slug: ServiceSlug) => {
      patch(wizardPatchForServiceSelection(slug));
    },
    [patch],
  );

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
            "Your quote is out of date. Review has been refreshed \u2014 please confirm again.",
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
    WIZARD_SERVICE_OPTIONS.find((s) => s.slug === state.serviceSlug)?.label ?? "\u2014";

  const isServiceStep = state.step === "service";
  const usesMobileStickyFooter =
    state.step === "details" || state.step === "review" || state.step === "checkout";
  const showWizardFrequency = ["details", "cleaner", "review", "checkout"].includes(
    state.step,
  );

  const wizardContextStrip =
    state.serviceSlug && state.step !== "service" ? (
      <WizardContextStrip
        serviceLabel={serviceLabel}
        serviceSlug={state.serviceSlug}
        bedrooms={state.bedrooms}
        bathrooms={state.bathrooms}
        propertySizeSqm={state.propertySizeSqm}
        frequency={state.frequency}
        showFrequency={showWizardFrequency}
      />
    ) : null;

  const mobileCommerceSummary =
    state.step === "review" && state.quote ? (
      <ReviewMobileCommerceSummary totalCents={state.quote.totalCents} />
    ) : state.step === "checkout" && state.quote ? (
      <CheckoutMobileCommerceSummary totalCents={state.quote.totalCents} />
    ) : null;

  const wizardNavElement = (
    <WizardNav
      className={
        isServiceStep || usesMobileStickyFooter
          ? `${WIZARD_MAIN_COLUMN_CLASS} mt-0 md:mt-6`
          : [WIZARD_MAIN_COLUMN_CLASS, getWizardNavClass(state.step)].filter(Boolean).join(" ")
      }
      showBack={!isServiceStep}
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
        state.step === "checkout" ? state.checkoutSubmitting || !state.quote : false
      }
      continueVariant={state.step === "checkout" ? "secure" : "default"}
    />
  );

  return (
    <div className={getWizardShellClass(state.step)}>
      <header className={`mb-4 ${WIZARD_MAIN_COLUMN_CLASS}`}>
        <h1 className="text-xl font-semibold text-zinc-900">Book a clean</h1>
        <p className="text-sm text-zinc-600">Shalean Cleaning Services</p>
      </header>

      <div className={WIZARD_MAIN_COLUMN_CLASS}>
        <WizardStepper current={state.step} />
      </div>

      {apiError ? (
        <div
          role="alert"
          className={`mb-4 break-words rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 ${WIZARD_MAIN_COLUMN_CLASS}`}
        >
          {apiError}
        </div>
      ) : null}

      <div className={`${getWizardCardClass(state.step)} ${WIZARD_MAIN_COLUMN_CLASS}`}>
        {state.step === "service" ? (
          <ServiceStepPanel
            options={WIZARD_SERVICE_OPTIONS}
            selectedSlug={state.serviceSlug}
            onSelect={handleSelectService}
            error={stepErrors.serviceSlug}
          />
        ) : null}

        {state.step === "datetime" ? (
          <>
            {wizardContextStrip}
            <ScheduleStepPanel
            date={state.date}
            time={state.time}
            minDate={minDate}
            dateError={stepErrors.date}
            timeError={stepErrors.time}
            onDateChange={(date) => patch({ date })}
            onTimeChange={(time) => patch({ time })}
          />
          </>
        ) : null}

        {state.step === "location" ? (
          <>
            {wizardContextStrip}
            <WizardStepHeading
              title="Location"
              subtitle="Where should we come to clean?"
            />
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
            <Field
              label="Mobile number"
              error={stepErrors.contactPhone}
              hint="South African mobile for booking updates (e.g. 082 123 4567)."
            >
              <input
                className={inputClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={state.contactPhone}
                onChange={(e) => patch({ contactPhone: e.target.value })}
              />
            </Field>
          </>
        ) : null}

        {state.step === "details" ? (
          <>
            {wizardContextStrip}
            <WizardStepHeading
              title="Details & add-ons"
              subtitle={
                state.serviceSlug === "office-cleaning"
                  ? "Workspace size, frequency, and optional add-ons."
                  : "Home size, frequency, and optional add-ons."
              }
            />
            {state.serviceSlug !== "office-cleaning" ? (
              <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:gap-4 [&>label]:mb-0">
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
              </div>
                {state.serviceSlug === "regular-cleaning" ? (
                  <div className="mb-4">
                    <Field label="Extra rooms" error={stepErrors.extraRooms}>
                      <p className="mb-2 text-xs leading-relaxed text-zinc-500">
                        Add rooms like a study, laundry room, playroom, or second lounge.
                      </p>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        className={inputClass}
                        value={state.extraRooms}
                        onChange={(e) => patch({ extraRooms: Number(e.target.value) })}
                      />
                    </Field>
                  </div>
                ) : null}
                {state.serviceSlug === "regular-cleaning" ? (
                  <CleaningIntensityStepPanel
                    value={state.cleaningIntensity}
                    onChange={(cleaningIntensity) => patch({ cleaningIntensity })}
                    error={stepErrors.cleaningIntensity}
                  />
                ) : null}
                {state.serviceSlug === "regular-cleaning" ? (
                  <EquipmentSupplyStepPanel
                    value={state.equipmentSupply}
                    onChange={(equipmentSupply) => patch({ equipmentSupply })}
                    error={stepErrors.equipmentSupply}
                  />
                ) : null}
                {state.serviceSlug === "regular-cleaning" ? (
                  <TeamSupportStepPanel
                    value={state.requestedTeamSize}
                    onChange={(requestedTeamSize) => patch({ requestedTeamSize })}
                    error={stepErrors.requestedTeamSize}
                  />
                ) : null}
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
            <FrequencyStepPanel
              value={state.frequency}
              onChange={(frequency) => patch({ frequency })}
            />
            <AddonsStepPanel
              selected={state.addons}
              onChange={(addons) => patch({ addons })}
            />
            <Field label="Special instructions">
              <textarea
                className={`${inputClass} min-h-[80px]`}
                value={state.specialInstructions}
                onChange={(e) => patch({ specialInstructions: e.target.value })}
              />
            </Field>
          </>
        ) : null}

        {state.step === "cleaner" ? (
          <>
            {wizardContextStrip}
            <CleanerStepPanel
              cleanerPreferenceMode={state.cleanerPreferenceMode}
              selectedCleanerId={state.selectedCleanerId}
              availableCleaners={state.availableCleaners}
              loading={loading}
              onSelectBestAvailable={() =>
                patch({
                  cleanerPreferenceMode: "best_available",
                  selectedCleanerId: null,
                  selectedCleanerDisplayName: null,
                })
              }
              onSelectCleaner={(cleanerId, displayName) =>
                patch({
                  cleanerPreferenceMode: "selected",
                  selectedCleanerId: cleanerId,
                  selectedCleanerDisplayName: displayName,
                })
              }
              selectedCleanerError={stepErrors.selectedCleanerId}
            />
          </>
        ) : null}

        {state.step === "review" ? (
          <div>
            {loading && !state.quote ? (
              <>
                {wizardContextStrip}
                <WizardStepHeading title="Review" />
                <p className="text-sm text-zinc-600">Calculating price?</p>
              </>
            ) : state.quote ? (
              <>
                {wizardContextStrip}
                <ReviewStepPanel
                  serviceLabel={serviceLabel}
                  serviceSlug={state.serviceSlug}
                  date={state.date}
                  time={state.time}
                  addressLine1={state.addressLine1}
                  suburb={state.suburb}
                  city={state.city}
                  contactPhone={state.contactPhone}
                  profilePhone={state.profilePhone}
                  bedrooms={state.bedrooms}
                  bathrooms={state.bathrooms}
                  extraRooms={state.extraRooms}
                  cleaningIntensity={state.cleaningIntensity}
                  equipmentSupply={state.equipmentSupply}
                  requestedTeamSize={state.requestedTeamSize}
                  propertySizeSqm={state.propertySizeSqm}
                  frequency={state.frequency}
                  addons={state.addons}
                  cleanerPreferenceMode={state.cleanerPreferenceMode}
                  selectedCleanerDisplayName={state.selectedCleanerDisplayName}
                  quote={state.quote}
                  reviewConfirmed={state.reviewConfirmed}
                  onReviewConfirmedChange={(reviewConfirmed) => patch({ reviewConfirmed })}
                  onEditStep={(step) => patch({ step })}
                  reviewConfirmedError={stepErrors.reviewConfirmed}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {state.step === "checkout" && state.quote ? (
          <>
            {wizardContextStrip}
            <CheckoutStepPanel
            serviceLabel={serviceLabel}
            serviceSlug={state.serviceSlug}
            date={state.date}
            time={state.time}
            suburb={state.suburb}
            city={state.city}
            bedrooms={state.bedrooms}
            bathrooms={state.bathrooms}
            extraRooms={state.extraRooms}
            cleaningIntensity={state.cleaningIntensity}
            equipmentSupply={state.equipmentSupply}
            requestedTeamSize={state.requestedTeamSize}
            propertySizeSqm={state.propertySizeSqm}
            frequency={state.frequency}
            quote={state.quote}
            customerEmail={customerEmail}
          />
          </>
        ) : null}
      </div>

      {isServiceStep ? (
        <div className={WIZARD_MOBILE_STICKY_FOOTER_CLASS}>
          <div className={WIZARD_STICKY_FOOTER_INNER_CLASS}>{wizardNavElement}</div>
        </div>
      ) : usesMobileStickyFooter ? (
        <WizardMobileStickyFooter summary={mobileCommerceSummary}>
          {wizardNavElement}
        </WizardMobileStickyFooter>
      ) : (
        <div className={WIZARD_MAIN_COLUMN_CLASS}>{wizardNavElement}</div>
      )}
    </div>
  );
}
