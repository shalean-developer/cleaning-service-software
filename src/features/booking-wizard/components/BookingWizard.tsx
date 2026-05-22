"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deferEffectWork } from "@/lib/react/deferEffectWork";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { getAccessNotesFieldCopy, getWizardCleanerFootnote } from "../airbnbCleaningDisplay";
import { syncBookServiceUrlOnSelection } from "../bookServiceRoute";
import { WIZARD_SERVICE_OPTIONS } from "../constants";
import type { BookingWindowBounds } from "../bookingWindowConfig";
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
import {
  applyPendingBookingIntentToWizardState,
  consumePendingBookingIntentForService,
} from "../pendingBookingIntent";
import { clearWizardStorage, loadWizardState, saveWizardState } from "../storage";
import { initialContactPhoneField } from "../contactPhone";
import {
  mergeLoadedWizardAddressDefaults,
  type LatestBookingAddressDefaults,
} from "../latestBookingAddressDefaults";
import {
  CHECKOUT_QUOTE_REQUIRED_MESSAGE,
  mergeWithQuoteInvalidation,
  shouldRedirectCheckoutWithoutQuote,
} from "../quoteInvalidation";
import { wizardPatchForServiceSelection } from "../serviceSelection";
import { INITIAL_WIZARD_STATE, type BookingWizardState } from "../types";
import { OperationalSuburbInput } from "@/components/locations/OperationalSuburbInput";
import { validateWizardStep } from "../validation";
import {
  getWizardCardClass,
  getWizardNavClass,
  getWizardNavStickyClassName,
  getWizardShellClass,
  getWizardStickyFooterInnerClass,
  usesWizardMobileStickyFooter,
  usesWizardStepSummarySidebar,
  WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS,
  WIZARD_MAIN_COLUMN_CLASS,
  WIZARD_STEP_CONTENT_TRANSITION_CLASS,
  WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS,
} from "../wizardLayout";
import { showWizardContextStripForService } from "../officeCleaningDisplay";
import { showFrequencyForService } from "../frequencyVisibility";
import { defaultRecurringDaysForDate } from "../recurringDaysWizard";
import { patchOfficeSizing } from "../officeSizing";
import { buildWizardBookingSummarySnapshot } from "../wizardBookingSummaryDisplay";
import { WizardBookingSummaryLayout } from "./WizardBookingSummaryLayout";
import { WizardStepper } from "./WizardStepper";
import { WizardNav } from "./WizardNav";
import { Field, inputClass } from "./Field";
import { CheckoutCtaTrustRow, CheckoutStepPanel } from "./CheckoutStepPanel";
import { formatZar } from "../format";
import { CleanerStepPanel } from "./CleanerStepPanel";
import { DetailsStepPanel } from "./DetailsStepPanel";
import { ReviewStepPanel } from "./ReviewStepPanel";
import { ScheduleStepPanel } from "./ScheduleStepPanel";
import { ServiceStepPanel } from "./ServiceStepPanel";
import { WizardContextStrip } from "./WizardContextStrip";
import {
  ReviewMobileCommerceSummary,
} from "./WizardMobileCommerceSummary";
import { WizardMobileStickyFooter } from "./WizardMobileStickyFooter";
import { WizardStepHeading } from "./WizardStepHeading";
import {
  BookingWizardPageHeader,
} from "./BookingWizardPageHeader";
import type { CustomerProfileMenuProps } from "@/components/dashboard/customer/CustomerProfileMenu";

type Props = {
  customerEmail: string;
  profileMenu: CustomerProfileMenuProps;
  initialServiceSlug?: ServiceSlug;
  initialCustomerPhone?: string | null;
  initialAddressDefaults?: LatestBookingAddressDefaults | null;
};

export function BookingWizard({
  customerEmail,
  profileMenu,
  initialServiceSlug,
  initialCustomerPhone = null,
  initialAddressDefaults = null,
}: Props) {
  const [state, setState] = useState<BookingWizardState>(INITIAL_WIZARD_STATE);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [bookingWindowBounds, setBookingWindowBounds] = useState<BookingWindowBounds | null>(
    null,
  );
  const [bookingWindowEnvMismatchWarning, setBookingWindowEnvMismatchWarning] = useState<
    string | null
  >(null);
  const hydrated = useRef(false);
  const checkoutLock = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  const initialAddressDefaultsKey = useMemo(
    () => JSON.stringify(initialAddressDefaults ?? {}),
    [initialAddressDefaults],
  );

  useEffect(() => {
    deferEffectWork(() => {
      const loaded = loadWizardState();
      const profilePhone = initialCustomerPhone?.trim() || null;
      let merged = mergeLoadedWizardAddressDefaults(loaded, initialAddressDefaults);
      merged = {
        ...merged,
        profilePhone,
        contactPhone: initialContactPhoneField(loaded.contactPhone, profilePhone),
      };

      const slug = initialServiceSlug ?? merged.serviceSlug;
      const pendingIntent = slug ? consumePendingBookingIntentForService(slug) : null;

      if (slug) {
        const servicePatch = wizardPatchForServiceSelection(slug);
        merged = pendingIntent
          ? applyPendingBookingIntentToWizardState(
              { ...merged, ...servicePatch },
              pendingIntent,
            )
          : { ...merged, ...servicePatch };
      } else if (pendingIntent) {
        merged = applyPendingBookingIntentToWizardState(merged, pendingIntent);
      }

      setState(merged);
      hydrated.current = true;
    });
  }, [initialServiceSlug, initialCustomerPhone, initialAddressDefaultsKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    saveWizardState(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/booking/window-bounds", {
          method: "GET",
          credentials: "same-origin",
        });
        const payload: unknown = await response.json().catch(() => ({}));
        if (cancelled || !response.ok || typeof payload !== "object" || payload == null) {
          return;
        }
        const data = payload as {
          ok?: boolean;
          minDate?: string;
          maxDate?: string;
          maxAdvanceDays?: number;
          extendedWindowEnabled?: boolean;
          envMismatchWarning?: string | null;
        };
        if (!data.ok || !data.minDate || !data.maxDate || data.maxAdvanceDays == null) {
          return;
        }
        setBookingWindowBounds({
          minDate: data.minDate,
          maxDate: data.maxDate,
          maxAdvanceDays: data.maxAdvanceDays,
          extendedWindowEnabled: data.extendedWindowEnabled === true,
        });
        setBookingWindowEnvMismatchWarning(data.envMismatchWarning ?? null);
      } catch {
        // Fall back to client env bounds in ScheduleStepPanel.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const wizardValidationOptions = useMemo(
    () =>
      bookingWindowBounds ? { bookingWindowBounds } : undefined,
    [bookingWindowBounds],
  );

  const patch = useCallback((partial: Partial<BookingWizardState>) => {
    setState((prev) => ({ ...prev, ...mergeWithQuoteInvalidation(prev, partial) }));
    setStepErrors({});
    setApiError(null);
  }, []);

  const handleSelectService = useCallback(
    (slug: ServiceSlug) => {
      syncBookServiceUrlOnSelection(slug, pathname, router.replace);
      setState((prev) => {
        const partial = wizardPatchForServiceSelection(slug);
        const next = { ...prev, ...mergeWithQuoteInvalidation(prev, partial) };
        saveWizardState(next);
        return next;
      });
      setStepErrors({});
      setApiError(null);
    },
    [pathname, router],
  );

  const minDate = useMemo(() => minBookableDateString(), []);

  const goNext = useCallback(async () => {
    const check = validateWizardStep(state.step, state, wizardValidationOptions);
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
  }, [state, patch, wizardValidationOptions]);

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
    if (state.step !== "review" || state.quote || loading) return;
    deferEffectWork(() => {
      void loadQuoteForReview();
    });
  }, [state.step, state.quote, loading, loadQuoteForReview]);

  useEffect(() => {
    if (!shouldRedirectCheckoutWithoutQuote(state)) return;
    deferEffectWork(() => {
      setStepErrors({});
      setApiError(CHECKOUT_QUOTE_REQUIRED_MESSAGE);
      setState((prev) => ({ ...prev, step: "review" }));
    });
  }, [state.step, state.quote]);

  const handleCheckout = useCallback(async () => {
    if (checkoutLock.current || state.checkoutSubmitting) return;

    const check = validateWizardStep("checkout", state, wizardValidationOptions);
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
  }, [state, customerEmail, patch, wizardValidationOptions]);

  const serviceLabel =
    WIZARD_SERVICE_OPTIONS.find((s) => s.slug === state.serviceSlug)?.label ?? "\u2014";

  const wizardSummarySnapshot = useMemo(
    () =>
      buildWizardBookingSummarySnapshot({
        serviceLabel,
        serviceSlug: state.serviceSlug,
        date: state.date,
        time: state.time,
        suburb: state.suburb,
        city: state.city,
        bedrooms: state.bedrooms,
        bathrooms: state.bathrooms,
        extraRooms: state.extraRooms,
        propertySizeSqm: state.propertySizeSqm,
        officeSizeTier: state.officeSizeTier,
        officeWorkstations: state.officeWorkstations,
        cleaningIntensity: state.cleaningIntensity,
        equipmentSupply: state.equipmentSupply,
        requestedTeamSize: state.requestedTeamSize,
        frequency: state.frequency,
        addons: state.addons,
        cleanerPreferenceMode: state.step === "cleaner" ? state.cleanerPreferenceMode : undefined,
        selectedCleanerDisplayName:
          state.step === "cleaner" ? state.selectedCleanerDisplayName : undefined,
      }),
    [
      serviceLabel,
      state.step,
      state.serviceSlug,
      state.date,
      state.time,
      state.suburb,
      state.city,
      state.bedrooms,
      state.bathrooms,
      state.extraRooms,
      state.propertySizeSqm,
      state.officeSizeTier,
      state.officeWorkstations,
      state.cleaningIntensity,
      state.equipmentSupply,
      state.requestedTeamSize,
      state.frequency,
      state.addons,
      state.cleanerPreferenceMode,
      state.selectedCleanerDisplayName,
    ],
  );

  const isServiceStep = state.step === "service";
  const usesMobileStickyFooter = usesWizardMobileStickyFooter(state.step);
  const showBookingSummarySidebar = usesWizardStepSummarySidebar(state.step);
  const bookingSummaryFootnote =
    state.step === "cleaner"
      ? getWizardCleanerFootnote(state.serviceSlug)
      : undefined;
  const showWizardFrequency =
    showFrequencyForService(state.serviceSlug) &&
    ["datetime", "cleaner", "review", "checkout"].includes(state.step);

  const wizardContextStrip =
    state.serviceSlug &&
    showWizardContextStripForService(state.serviceSlug) &&
    state.step !== "service" &&
    state.step !== "location" &&
    state.step !== "details" &&
    state.step !== "checkout" ? (
      <WizardContextStrip
        serviceLabel={serviceLabel}
        serviceSlug={state.serviceSlug}
        bedrooms={state.bedrooms}
        bathrooms={state.bathrooms}
        propertySizeSqm={state.propertySizeSqm}
        officeSizeTier={state.officeSizeTier}
        officeWorkstations={state.officeWorkstations}
        frequency={state.frequency}
        showFrequency={showWizardFrequency}
      />
    ) : null;

  const mobileCommerceSummary =
    state.step === "review" && state.quote ? (
      <ReviewMobileCommerceSummary totalCents={state.quote.totalCents} />
    ) : state.step === "checkout" ? (
      <CheckoutCtaTrustRow className={WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS} />
    ) : null;

  const wizardNavElement = (
    <WizardNav
      className={
        usesMobileStickyFooter
          ? getWizardNavStickyClassName()
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
        state.step === "checkout" && state.quote
          ? `Pay ${formatZar(state.quote.totalCents)} securely`
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

  const wizardStepCard = (
    <div
      key={state.step}
      className={`${getWizardCardClass(state.step)} ${WIZARD_MAIN_COLUMN_CLASS} ${WIZARD_STEP_CONTENT_TRANSITION_CLASS}`}
    >
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
            <ScheduleStepPanel
            serviceSlug={state.serviceSlug}
            date={state.date}
            time={state.time}
            frequency={state.frequency}
            recurringDays={state.recurringDays}
            minDate={minDate}
            bookingBounds={bookingWindowBounds}
            envMismatchWarning={bookingWindowEnvMismatchWarning}
            dateError={stepErrors.date}
            timeError={stepErrors.time}
            frequencyError={stepErrors.frequency}
            recurringDaysError={stepErrors.recurringDays}
            onDateChange={(date) =>
              patch({
                date,
                recurringDays: defaultRecurringDaysForDate(date, state.recurringDays),
              })
            }
            onTimeChange={(time) => patch({ time })}
            onFrequencyChange={(frequency) =>
              patch({
                frequency,
                recurringDays:
                  frequency === "weekly" || frequency === "biweekly"
                    ? defaultRecurringDaysForDate(state.date, state.recurringDays)
                    : [],
              })
            }
            onRecurringDaysChange={(recurringDays) => patch({ recurringDays })}
          />
          </>
        ) : null}

        {state.step === "location" ? (
          <>
            <WizardStepHeading title="Location" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>label]:mb-0">
              <Field label="Street address" error={stepErrors.addressLine1}>
                <input
                  className={`${inputClass} ${WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS}`}
                  value={state.addressLine1}
                  onChange={(e) => patch({ addressLine1: e.target.value })}
                  autoComplete="street-address"
                />
              </Field>
              <Field label="Suburb" error={stepErrors.suburb}>
                <OperationalSuburbInput
                  className={`${inputClass} ${WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS}`}
                  value={state.suburb}
                  onChange={(suburb) => patch({ suburb })}
                  aria-invalid={Boolean(stepErrors.suburb)}
                />
              </Field>
              <Field label="City" error={stepErrors.city}>
                <input
                  className={`${inputClass} ${WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS}`}
                  value={state.city}
                  onChange={(e) => patch({ city: e.target.value })}
                />
              </Field>
              <Field label="Mobile number" error={stepErrors.contactPhone}>
                <input
                  className={`${inputClass} ${WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS}`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={state.contactPhone}
                  onChange={(e) => patch({ contactPhone: e.target.value })}
                />
              </Field>
            </div>
            <div className="mt-4">
              {(() => {
                const accessCopy = getAccessNotesFieldCopy(state.serviceSlug);
                return (
                  <Field label={accessCopy.label}>
                    {accessCopy.hint ? (
                      <p className="mb-1.5 text-xs leading-snug text-zinc-500">{accessCopy.hint}</p>
                    ) : null}
                    <textarea
                      className={`${inputClass} min-h-[80px] ${WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS}`}
                      value={state.locationNotes}
                      onChange={(e) => patch({ locationNotes: e.target.value })}
                      placeholder={accessCopy.placeholder}
                    />
                  </Field>
                );
              })()}
            </div>
          </>
        ) : null}

        {state.step === "details" ? (
          <>
            <DetailsStepPanel
              serviceSlug={state.serviceSlug}
              bedrooms={state.bedrooms}
              bathrooms={state.bathrooms}
              extraRooms={state.extraRooms}
              propertySizeSqm={state.propertySizeSqm}
              officeSizeTier={state.officeSizeTier}
              officeWorkstations={state.officeWorkstations}
              cleaningIntensity={state.cleaningIntensity}
              equipmentSupply={state.equipmentSupply}
              requestedTeamSize={state.requestedTeamSize}
              addons={state.addons}
              carpetStainSeverity={state.carpetStainSeverity}
              carpetPetStains={state.carpetPetStains}
              carpetGoodDryingAirflow={state.carpetGoodDryingAirflow}
              specialInstructions={state.specialInstructions}
              stepErrors={stepErrors}
              onBedroomsChange={(bedrooms) => patch({ bedrooms })}
              onBathroomsChange={(bathrooms) => patch({ bathrooms })}
              onExtraRoomsChange={(extraRooms) => patch({ extraRooms })}
              onPropertySizeSqmChange={(propertySizeSqm) => patch({ propertySizeSqm })}
              onOfficeSizeChange={(officeSizeTier) => {
                setState((prev) => ({
                  ...prev,
                  ...mergeWithQuoteInvalidation(
                    prev,
                    patchOfficeSizing(
                      { officeSizeTier },
                      {
                        officeSizeTier: prev.officeSizeTier,
                        officeWorkstations: prev.officeWorkstations,
                      },
                    ),
                  ),
                }));
                setStepErrors({});
                setApiError(null);
              }}
              onOfficeWorkstationsChange={(officeWorkstations) => {
                setState((prev) => ({
                  ...prev,
                  ...mergeWithQuoteInvalidation(
                    prev,
                    patchOfficeSizing(
                      { officeWorkstations },
                      {
                        officeSizeTier: prev.officeSizeTier,
                        officeWorkstations: prev.officeWorkstations,
                      },
                    ),
                  ),
                }));
                setStepErrors({});
                setApiError(null);
              }}
              onCleaningIntensityChange={(cleaningIntensity) => patch({ cleaningIntensity })}
              onEquipmentSupplyChange={(equipmentSupply) => patch({ equipmentSupply })}
              onRequestedTeamSizeChange={(requestedTeamSize) => patch({ requestedTeamSize })}
              onAddonsChange={(addons) => patch({ addons })}
              onCarpetStainSeverityChange={(carpetStainSeverity) =>
                patch({ carpetStainSeverity })
              }
              onCarpetPetStainsChange={(carpetPetStains) => patch({ carpetPetStains })}
              onCarpetGoodDryingAirflowChange={(carpetGoodDryingAirflow) =>
                patch({ carpetGoodDryingAirflow })
              }
              onSpecialInstructionsChange={(specialInstructions) =>
                patch({ specialInstructions })
              }
            />
          </>
        ) : null}

        {state.step === "cleaner" ? (
          <>
            {wizardContextStrip}
            <CleanerStepPanel
              serviceSlug={state.serviceSlug}
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
                <p className="text-sm text-zinc-600">Calculating price…</p>
              </>
            ) : state.quote ? (
              <>
                <ReviewStepPanel
                  serviceLabel={serviceLabel}
                  serviceSlug={state.serviceSlug}
                  date={state.date}
                  time={state.time}
                  addressLine1={state.addressLine1}
                  suburb={state.suburb}
                  city={state.city}
                  locationNotes={state.locationNotes}
                  contactPhone={state.contactPhone}
                  profilePhone={state.profilePhone}
                  bedrooms={state.bedrooms}
                  bathrooms={state.bathrooms}
                  extraRooms={state.extraRooms}
                  cleaningIntensity={state.cleaningIntensity}
                  equipmentSupply={state.equipmentSupply}
                  requestedTeamSize={state.requestedTeamSize}
                  propertySizeSqm={state.propertySizeSqm}
                  officeSizeTier={state.officeSizeTier}
                  officeWorkstations={state.officeWorkstations}
                  frequency={state.frequency}
                  recurringDays={state.recurringDays}
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
          <CheckoutStepPanel
            serviceLabel={serviceLabel}
            serviceSlug={state.serviceSlug}
            date={state.date}
            time={state.time}
            suburb={state.suburb}
            city={state.city}
            bedrooms={state.bedrooms}
            bathrooms={state.bathrooms}
            propertySizeSqm={state.propertySizeSqm}
            officeSizeTier={state.officeSizeTier}
            officeWorkstations={state.officeWorkstations}
            frequency={state.frequency}
            quote={state.quote}
            customerEmail={customerEmail}
          />
        ) : null}
    </div>
  );

  return (
    <div className={getWizardShellClass(state.step)}>
      <BookingWizardPageHeader profileMenu={profileMenu} />

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

      {showBookingSummarySidebar ? (
        <WizardBookingSummaryLayout
          snapshot={wizardSummarySnapshot}
          footnote={bookingSummaryFootnote}
        >
          {wizardStepCard}
        </WizardBookingSummaryLayout>
      ) : (
        wizardStepCard
      )}

      {usesMobileStickyFooter ? (
        <WizardMobileStickyFooter
          summary={mobileCommerceSummary}
          innerClassName={getWizardStickyFooterInnerClass(state.step)}
        >
          {wizardNavElement}
        </WizardMobileStickyFooter>
      ) : (
        <div className={WIZARD_MAIN_COLUMN_CLASS}>{wizardNavElement}</div>
      )}
    </div>
  );
}
