"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { buildCleanerIdentityEmail } from "@/features/cleaners/cleanerIdentity";
import { CleanerIdentityPreview } from "./CleanerIdentityPreview";
import { CLEANER_AVAILABILITY_DAY_OPTIONS } from "@/features/cleaners/admin/cleanerAvailability";
import {
  trackCleanerApplyStarted,
  trackCleanerApplyStepCompleted,
  trackCleanerApplySubmitted,
  trackCleanerApplyView,
} from "@/features/analytics/cleanerApplyEvents";
import {
  clearCleanerApplyDraft,
  loadCleanerApplyDraft,
  mergeDraftWithDefaults,
  saveCleanerApplyDraft,
} from "@/features/cleaner-applications/applyDraftStorage";
import {
  CLEANER_APPLY_FORM_STEPS,
  CLEANER_APPLY_SKILL_KEYS,
  CLEANER_APPLY_SKILL_LABELS,
  CLEANER_APPLY_WORK_PREFERENCE_LABELS,
  CLEANER_APPLY_WORK_PREFERENCES,
  INITIAL_CLEANER_APPLY_FORM,
  validateCleanerApplyStep,
  type CleanerApplyFieldErrors,
  type CleanerApplyFormState,
  type CleanerApplyWorkPreference,
} from "@/features/cleaner-applications/applyFormModel";
import { CLEANER_APPLY_EXPERIENCE_LEVELS } from "@/features/cleaner-applications/types";
import { OperationalAreaChipGroups } from "@/components/locations/OperationalAreaChipGroups";
import {
  APPLY_CARD_CLASS,
  APPLY_CHIP_IDLE,
  APPLY_CHIP_SELECTED,
  APPLY_ERROR_CLASS,
  APPLY_HELPER_CLASS,
  APPLY_INPUT_CLASS,
  APPLY_LABEL_CLASS,
  APPLY_TOGGLE_IDLE,
  APPLY_TOGGLE_SELECTED,
} from "./applyUi";

const EXPERIENCE_LABELS: Record<(typeof CLEANER_APPLY_EXPERIENCE_LEVELS)[number], string> = {
  less_than_1_year: "Less than 1 year",
  "1_3_years": "1–3 years",
  "3_plus_years": "3+ years",
};

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function YesNoToggle({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <fieldset>
      <legend className={APPLY_LABEL_CLASS}>{label}</legend>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          { label: "Yes", v: true },
          { label: "No", v: false },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
              value === opt.v ? APPLY_TOGGLE_SELECTED : APPLY_TOGGLE_IDLE
            }`}
            onClick={() => onChange(opt.v)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function formToPayload(values: CleanerApplyFormState) {
  const phone = values.phone.trim();
  const generatedEmail = buildCleanerIdentityEmail(phone);
  return {
    fullName: values.fullName.trim(),
    phone,
    ...(generatedEmail ? { email: generatedEmail } : {}),
    suburb: values.suburb.trim(),
    city: values.city.trim() || "Cape Town",
    availabilityDays: values.availabilityDays,
    preferredAreas: values.preferredAreas,
    hasOwnTransport: values.hasOwnTransport === true,
    workPreferences: values.workPreferences,
    experienceLevel: values.experienceLevel,
    workedInHomes: values.workedInHomes === true,
    airbnbExperience: values.airbnbExperience === true,
    skills: values.skills,
    notes: values.notes.trim() || undefined,
    references: values.references.filter((r) => r.name.trim() && r.phone.trim()),
    consent: true as const,
    website: values.website,
  };
}

export function CleanerApplyForm() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<CleanerApplyFormState>(INITIAL_CLEANER_APPLY_FORM);
  const [errors, setErrors] = useState<CleanerApplyFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    trackCleanerApplyView();
    const draft = loadCleanerApplyDraft();
    if (draft) {
      setValues(mergeDraftWithDefaults(draft.values));
      setStep(Math.min(draft.step, CLEANER_APPLY_FORM_STEPS.length - 1));
      setDraftRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!successMessage) {
      saveCleanerApplyDraft(step, values);
    }
  }, [step, values, successMessage]);

  const progressPct = useMemo(
    () => Math.round(((step + 1) / CLEANER_APPLY_FORM_STEPS.length) * 100),
    [step],
  );

  const goNext = useCallback(() => {
    const stepErrors = validateCleanerApplyStep(step, values);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    if (step === 0) trackCleanerApplyStarted();
    trackCleanerApplyStepCompleted(step + 1, CLEANER_APPLY_FORM_STEPS[step]?.id ?? "unknown");
    setStep((s) => Math.min(s + 1, CLEANER_APPLY_FORM_STEPS.length - 1));
  }, [step, values]);

  const goBack = useCallback(() => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const stepErrors = validateCleanerApplyStep(3, values);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch("/api/cleaner-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(values)),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        duplicateLikely?: boolean;
        status?: string;
      };

      if (!response.ok || !data.ok) {
        setErrors({
          submit:
            (data as { message?: string }).message ??
            "Could not submit your application. Please try again.",
        });
        return;
      }

      clearCleanerApplyDraft();
      trackCleanerApplySubmitted({
        status: data.status ?? "new",
        duplicate: data.duplicateLikely,
      });
      setSuccessMessage(
        data.message ??
          "Thank you. Your application has been received and will be reviewed by our team.",
      );
    } catch {
      setErrors({ submit: "Network error. Please check your connection and try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (successMessage) {
    return (
      <div
        className={`${APPLY_CARD_CLASS} p-8 text-center sm:p-10`}
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-7 w-7" aria-hidden />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-slate-900">Application received</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
          {successMessage}
        </p>
        <p className="mt-6 text-sm text-slate-500">
          Applications are reviewed before activation. We will contact you if your profile is a
          fit.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Already have a cleaner account?{" "}
          <Link
            href="/sign-in?redirectedFrom=/cleaner/offers"
            className="font-semibold text-shalean-primary underline-offset-2 hover:underline"
          >
            Cleaner sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={`${APPLY_CARD_CLASS} relative overflow-hidden`}>
      <form id="application-form" onSubmit={handleSubmit} noValidate className="flex flex-col">
        <div className="border-b border-slate-100 px-5 py-6 sm:px-8 sm:py-7">
          {draftRestored ? (
            <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              We restored your saved draft. You can continue where you left off.
            </p>
          ) : null}

          <div className="hidden sm:block">
            <ol className="flex items-center justify-between gap-2" aria-label="Application progress">
              {CLEANER_APPLY_FORM_STEPS.map((s, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <li key={s.id} className="flex flex-1 items-center gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        done
                          ? "bg-shalean-primary text-white"
                          : active
                            ? "bg-shalean-primary/15 text-shalean-primary"
                            : "bg-slate-100 text-slate-400"
                      }`}
                      aria-current={active ? "step" : undefined}
                    >
                      {done ? <Check className="h-4 w-4" /> : i + 1}
                    </span>
                    <span
                      className={`hidden text-xs font-medium lg:inline ${
                        active ? "text-shalean-navy" : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                    {i < CLEANER_APPLY_FORM_STEPS.length - 1 ? (
                      <span className="mx-1 h-px flex-1 bg-slate-200" aria-hidden />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="sm:hidden">
            <p className="text-sm font-medium text-slate-700">
              Step {step + 1} of {CLEANER_APPLY_FORM_STEPS.length}
            </p>
            <p className="text-xs text-slate-500">{CLEANER_APPLY_FORM_STEPS[step]?.label}</p>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-shalean-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div className="relative px-5 py-6 sm:px-8 sm:py-8">
          <div
            className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
            aria-hidden
          >
            <label htmlFor="website">Website</label>
            <input
              id="website"
              tabIndex={-1}
              autoComplete="off"
              value={values.website}
              onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
            />
          </div>

          {step === 0 ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Personal details</h3>
                <p className={APPLY_HELPER_CLASS}>
                  We&apos;ll use these details to contact you about your application.
                </p>
              </div>
              <div>
                <label htmlFor="fullName" className={APPLY_LABEL_CLASS}>
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="fullName"
                  className={APPLY_INPUT_CLASS}
                  value={values.fullName}
                  onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))}
                  autoComplete="name"
                />
                {errors.fullName ? <p className={APPLY_ERROR_CLASS}>{errors.fullName}</p> : null}
              </div>
              <div>
                <label htmlFor="phone" className={APPLY_LABEL_CLASS}>
                  Phone number <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  className={APPLY_INPUT_CLASS}
                  placeholder="e.g. 082 123 4567"
                  value={values.phone}
                  onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
                  autoComplete="tel"
                />
                {errors.phone ? <p className={APPLY_ERROR_CLASS}>{errors.phone}</p> : null}
              </div>
              <CleanerIdentityPreview phone={values.phone} />
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="suburb" className={APPLY_LABEL_CLASS}>
                    Suburb <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="suburb"
                    className={APPLY_INPUT_CLASS}
                    value={values.suburb}
                    onChange={(e) => setValues((v) => ({ ...v, suburb: e.target.value }))}
                  />
                  {errors.suburb ? <p className={APPLY_ERROR_CLASS}>{errors.suburb}</p> : null}
                </div>
                <div>
                  <label htmlFor="city" className={APPLY_LABEL_CLASS}>
                    City
                  </label>
                  <input
                    id="city"
                    className={APPLY_INPUT_CLASS}
                    value={values.city}
                    onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Availability & work preferences</h3>
                <p className={APPLY_HELPER_CLASS}>
                  Tell us when and where you prefer to work. This helps us match relevant
                  opportunities.
                </p>
              </div>
              <fieldset>
                <legend className={APPLY_LABEL_CLASS}>
                  Available days <span className="text-red-500">*</span>
                </legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CLEANER_AVAILABILITY_DAY_OPTIONS.map((day) => {
                    const selected = values.availabilityDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                          selected ? APPLY_CHIP_SELECTED : APPLY_CHIP_IDLE
                        }`}
                        onClick={() =>
                          setValues((v) => ({
                            ...v,
                            availabilityDays: toggleInList(v.availabilityDays, day.value),
                          }))
                        }
                      >
                        {day.shortLabel}
                      </button>
                    );
                  })}
                </div>
                {errors.availabilityDays ? (
                  <p className={APPLY_ERROR_CLASS}>{errors.availabilityDays}</p>
                ) : null}
              </fieldset>
              <fieldset>
                <legend className={APPLY_LABEL_CLASS}>
                  Preferred work areas <span className="text-red-500">*</span>
                </legend>
                <OperationalAreaChipGroups
                  selected={values.preferredAreas}
                  onToggle={(area) =>
                    setValues((v) => ({
                      ...v,
                      preferredAreas: toggleInList(v.preferredAreas, area),
                    }))
                  }
                  chipClass={(selected) =>
                    `rounded-full border px-3.5 py-2 text-sm transition-all ${
                      selected ? APPLY_CHIP_SELECTED : APPLY_CHIP_IDLE
                    }`
                  }
                />
                {errors.preferredAreas ? (
                  <p className={APPLY_ERROR_CLASS}>{errors.preferredAreas}</p>
                ) : null}
              </fieldset>
              <YesNoToggle
                label="Do you have your own transport?"
                value={values.hasOwnTransport}
                onChange={(v) => setValues((s) => ({ ...s, hasOwnTransport: v }))}
              />
              {errors.hasOwnTransport ? (
                <p className={APPLY_ERROR_CLASS}>{errors.hasOwnTransport}</p>
              ) : null}
              <fieldset>
                <legend className={APPLY_LABEL_CLASS}>
                  Work type preferences <span className="text-red-500">*</span>
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {CLEANER_APPLY_WORK_PREFERENCES.map((pref) => {
                    const selected = values.workPreferences.includes(pref);
                    return (
                      <button
                        key={pref}
                        type="button"
                        className={`rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all ${
                          selected ? APPLY_TOGGLE_SELECTED : APPLY_TOGGLE_IDLE
                        }`}
                        onClick={() =>
                          setValues((v) => ({
                            ...v,
                            workPreferences: toggleInList(
                              v.workPreferences,
                              pref as CleanerApplyWorkPreference,
                            ),
                          }))
                        }
                      >
                        {CLEANER_APPLY_WORK_PREFERENCE_LABELS[pref]}
                      </button>
                    );
                  })}
                </div>
                {errors.workPreferences ? (
                  <p className={APPLY_ERROR_CLASS}>{errors.workPreferences}</p>
                ) : null}
              </fieldset>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Experience & skills</h3>
                <p className={APPLY_HELPER_CLASS}>
                  Share your background so our team can review your fit. No documents required at
                  this stage.
                </p>
              </div>
              <div>
                <label htmlFor="experienceLevel" className={APPLY_LABEL_CLASS}>
                  Years of cleaning experience <span className="text-red-500">*</span>
                </label>
                <select
                  id="experienceLevel"
                  className={APPLY_INPUT_CLASS}
                  value={values.experienceLevel}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      experienceLevel: e.target.value as CleanerApplyFormState["experienceLevel"],
                    }))
                  }
                >
                  <option value="">Select experience…</option>
                  {CLEANER_APPLY_EXPERIENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {EXPERIENCE_LABELS[level]}
                    </option>
                  ))}
                </select>
                {errors.experienceLevel ? (
                  <p className={APPLY_ERROR_CLASS}>{errors.experienceLevel}</p>
                ) : null}
              </div>
              <YesNoToggle
                label="Have you worked in homes before?"
                value={values.workedInHomes}
                onChange={(v) => setValues((s) => ({ ...s, workedInHomes: v }))}
              />
              {errors.workedInHomes ? (
                <p className={APPLY_ERROR_CLASS}>{errors.workedInHomes}</p>
              ) : null}
              <YesNoToggle
                label="Have you cleaned Airbnb or short-stay properties?"
                value={values.airbnbExperience}
                onChange={(v) => setValues((s) => ({ ...s, airbnbExperience: v }))}
              />
              {errors.airbnbExperience ? (
                <p className={APPLY_ERROR_CLASS}>{errors.airbnbExperience}</p>
              ) : null}
              <fieldset>
                <legend className={APPLY_LABEL_CLASS}>Additional skills</legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {CLEANER_APPLY_SKILL_KEYS.map((key) => (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                        values.skills[key] ? APPLY_TOGGLE_SELECTED : APPLY_TOGGLE_IDLE
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-shalean-primary focus:ring-shalean-primary/30"
                        checked={values.skills[key]}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            skills: { ...v.skills, [key]: e.target.checked },
                          }))
                        }
                      />
                      {CLEANER_APPLY_SKILL_LABELS[key]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="notes" className={APPLY_LABEL_CLASS}>
                  Tell us about your experience
                </label>
                <textarea
                  id="notes"
                  rows={4}
                  className={APPLY_INPUT_CLASS}
                  placeholder="Optional — types of homes, teams, or specialties"
                  value={values.notes}
                  onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
                />
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <p className={APPLY_LABEL_CLASS}>References (optional)</p>
                <p className={APPLY_HELPER_CLASS}>You may add up to two references.</p>
                <div className="mt-4 space-y-4">
                  {values.references.map((ref, index) => (
                    <div key={index} className="grid gap-3 sm:grid-cols-2">
                      <input
                        className={APPLY_INPUT_CLASS}
                        placeholder="Reference name"
                        value={ref.name}
                        onChange={(e) => {
                          const next = [...values.references];
                          next[index] = { ...next[index]!, name: e.target.value };
                          setValues((v) => ({ ...v, references: next }));
                        }}
                      />
                      <input
                        className={APPLY_INPUT_CLASS}
                        placeholder="Reference phone"
                        type="tel"
                        value={ref.phone}
                        onChange={(e) => {
                          const next = [...values.references];
                          next[index] = { ...next[index]!, phone: e.target.value };
                          setValues((v) => ({ ...v, references: next }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                {values.references.length < 2 ? (
                  <button
                    type="button"
                    className="mt-3 text-sm font-medium text-shalean-primary hover:underline"
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        references: [...v.references, { name: "", phone: "" }],
                      }))
                    }
                  >
                    Add another reference
                  </button>
                ) : null}
                {errors.reference ? <p className={APPLY_ERROR_CLASS}>{errors.reference}</p> : null}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Review & consent</h3>
                <p className={APPLY_HELPER_CLASS}>
                  Check your answers before submitting. Applications are reviewed before any
                  cleaner account is activated.
                </p>
              </div>
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50 text-sm">
                <div className="px-4 py-3">
                  <dt className="font-medium text-slate-500">Contact</dt>
                  <dd className="mt-1 text-slate-800">
                    {values.fullName} · {values.phone}
                  </dd>
                  <dd className="mt-1 font-mono text-xs text-slate-600">
                    {buildCleanerIdentityEmail(values.phone) ?? "Phone number required"}
                  </dd>
                  <dd className="text-slate-600">
                    {values.suburb}, {values.city}
                  </dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="font-medium text-slate-500">Availability & areas</dt>
                  <dd className="mt-1 text-slate-800">
                    {values.availabilityDays
                      .map(
                        (d) =>
                          CLEANER_AVAILABILITY_DAY_OPTIONS.find((o) => o.value === d)
                            ?.label ?? d,
                      )
                      .join(", ")}
                  </dd>
                  <dd className="text-slate-600">{values.preferredAreas.join(", ")}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="font-medium text-slate-500">Work preferences</dt>
                  <dd className="mt-1 text-slate-800">
                    {values.workPreferences
                      .map((p) => CLEANER_APPLY_WORK_PREFERENCE_LABELS[p])
                      .join(", ")}
                  </dd>
                  <dd className="text-slate-600">
                    Transport: {values.hasOwnTransport ? "Yes" : "No"}
                  </dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="font-medium text-slate-500">Experience</dt>
                  <dd className="mt-1 text-slate-800">
                    {values.experienceLevel
                      ? EXPERIENCE_LABELS[
                          values.experienceLevel as keyof typeof EXPERIENCE_LABELS
                        ]
                      : "—"}
                  </dd>
                </div>
              </dl>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-shalean-primary"
                  checked={values.consent}
                  onChange={(e) => setValues((v) => ({ ...v, consent: e.target.checked }))}
                />
                <span className="text-sm leading-relaxed text-slate-700">
                  I agree that Shalean may contact me regarding cleaner opportunities and
                  onboarding. <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.consent ? <p className={APPLY_ERROR_CLASS}>{errors.consent}</p> : null}
            </div>
          ) : null}

          {errors.submit ? <p className={APPLY_ERROR_CLASS}>{errors.submit}</p> : null}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:static sm:px-8 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={goBack}
                disabled={submitting}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
            ) : (
              <span />
            )}
            {step < CLEANER_APPLY_FORM_STEPS.length - 1 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-shalean-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
                onClick={goNext}
              >
                Continue
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-shalean-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  "Submit application"
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
