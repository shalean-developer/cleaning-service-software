"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";
import { CLEANER_CAPABILITY_OPTIONS } from "@/features/cleaners/admin/cleanerCapabilityOptions";
import type { CleanerAvailabilityFormValues } from "@/features/cleaners/admin/cleanerAvailability";
import {
  formatServiceAreaSlugsForInput,
  validateCleanerEditForm,
  type CleanerEditFormErrors,
  type CleanerEditFormField,
} from "@/features/cleaners/admin/cleanerProfileEditValidation";
import { AdminServiceAreasTextarea } from "@/components/dashboard/admin/AdminServiceAreasTextarea";
import { CleanerAvailabilityFields } from "@/components/dashboard/admin/CleanerAvailabilityFields";
import { parseServiceAreasInput } from "@/features/cleaners/admin/cleanerProfileFormValidation";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { ADMIN_SECTION_MUTED_CLASS } from "@/features/dashboards/adminDisplay";
import { formatZaMobileForDisplay } from "@/lib/validation/zaPhone";

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

const READONLY_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700";

const INPUT_ERROR_CLASS = "border-red-300 focus-visible:ring-red-600";

const FIELD_ERROR_CLASS = "mt-1 text-xs text-red-700";

function fieldClass(hasError: boolean): string {
  return hasError ? `${INPUT_CLASS} ${INPUT_ERROR_CLASS}` : INPUT_CLASS;
}

export type AdminCleanerProfileFormProps = {
  cleanerId: string;
  initialFullName: string;
  initialCapabilities: ServiceSlug[];
  initialServiceAreaSlugs: string[];
  initialAvailability: CleanerAvailabilityFormValues;
  readOnlyPhone: string | null;
  readOnlyLoginEmail: string | null;
};

export function AdminCleanerProfileForm({
  cleanerId,
  initialFullName,
  initialCapabilities,
  initialServiceAreaSlugs,
  initialAvailability,
  readOnlyPhone,
  readOnlyLoginEmail,
}: AdminCleanerProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    fullName: initialFullName,
    serviceAreasInput: formatServiceAreaSlugsForInput(initialServiceAreaSlugs),
    capabilities: initialCapabilities,
    ...initialAvailability,
  });
  const [errors, setErrors] = useState<CleanerEditFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<CleanerEditFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validation = useMemo(() => validateCleanerEditForm(values), [values]);
  const normalizedAreas = useMemo(
    () => parseServiceAreasInput(values.serviceAreasInput),
    [values.serviceAreasInput],
  );
  const phoneDisplay = useMemo(
    () => (readOnlyPhone ? formatZaMobileForDisplay(readOnlyPhone) : null) ?? readOnlyPhone ?? "-",
    [readOnlyPhone],
  );

  function showError(field: CleanerEditFormField): string | undefined {
    if (!submitAttempted && !touched[field]) return undefined;
    return errors[field] ?? validation.errors[field];
  }

  function touch(field: CleanerEditFormField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function runValidation(): boolean {
    const result = validateCleanerEditForm(values);
    setErrors(result.errors);
    return result.valid;
  }

  function toggleCapability(slug: ServiceSlug) {
    setValues((prev) => {
      const selected = prev.capabilities.includes(slug);
      return {
        ...prev,
        capabilities: selected
          ? prev.capabilities.filter((s) => s !== slug)
          : [...prev.capabilities, slug],
      };
    });
    touch("capabilities");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);
    setSuccessMessage(null);

    if (!runValidation()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/cleaners/${cleanerId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          serviceAreasInput: values.serviceAreasInput,
          capabilities: values.capabilities,
          workingDays: values.workingDays,
          startTime: values.startTime,
          endTime: values.endTime,
          timezone: values.timezone,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !result.ok) {
        setSubmitError(result.message ?? result.error ?? "Failed to update profile.");
        return;
      }

      setSuccessMessage(result.message ?? "Cleaner profile updated.");
      router.refresh();
    } catch {
      setSubmitError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Edit name, capabilities, and service areas only. Phone, login email, and lifecycle state
        are managed separately.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800">Full name</span>
          <input
            type="text"
            name="fullName"
            autoComplete="name"
            className={fieldClass(Boolean(showError("fullName")))}
            value={values.fullName}
            onChange={(e) => setValues((prev) => ({ ...prev, fullName: e.target.value }))}
            onBlur={() => touch("fullName")}
            aria-invalid={Boolean(showError("fullName"))}
          />
          {showError("fullName") ? (
            <p className={FIELD_ERROR_CLASS}>{showError("fullName")}</p>
          ) : null}
        </label>

        <div className="block text-sm">
          <span className="font-medium text-zinc-800">Phone</span>
          <output className={READONLY_CLASS} aria-label="Phone number (read-only)">
            {phoneDisplay}
          </output>
          <p className="mt-1 text-xs text-zinc-500">Immutable in v1. contact support to change.</p>
        </div>

        <div className="block text-sm">
          <span className="font-medium text-zinc-800">Login email</span>
          <output className={READONLY_CLASS} aria-label="Login email (read-only)">
            {readOnlyLoginEmail ?? "-"}
          </output>
          <p className="mt-1 text-xs text-zinc-500">Generated from phone. not editable.</p>
        </div>

        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800">
            Service areas <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <AdminServiceAreasTextarea
            className={fieldClass(Boolean(showError("serviceAreasInput")))}
            value={values.serviceAreasInput}
            onChange={(serviceAreasInput) =>
              setValues((prev) => ({ ...prev, serviceAreasInput }))
            }
            onBlur={() => touch("serviceAreasInput")}
            aria-invalid={Boolean(showError("serviceAreasInput"))}
          />
          {normalizedAreas.length > 0 ? (
            <p className="mt-1 text-xs text-zinc-600">
              Preview: {normalizedAreas.join(", ")}
            </p>
          ) : (
            <p className="mt-1 text-xs text-zinc-500">Leave empty to match all areas.</p>
          )}
          {showError("serviceAreasInput") ? (
            <p className={FIELD_ERROR_CLASS}>{showError("serviceAreasInput")}</p>
          ) : null}
        </label>
      </div>

      <CleanerAvailabilityFields
        values={{
          workingDays: values.workingDays,
          startTime: values.startTime,
          endTime: values.endTime,
          timezone: values.timezone,
        }}
        onChange={(availability) => setValues((prev) => ({ ...prev, ...availability }))}
        errors={{ ...validation.errors, ...errors }}
        touched={touched}
        submitAttempted={submitAttempted}
        onTouch={touch}
        disabled={submitting}
      />

      <fieldset className="text-sm">
        <legend className="font-medium text-zinc-800">Service capabilities</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {CLEANER_CAPABILITY_OPTIONS.map((option) => {
            const checked = values.capabilities.includes(option.slug);
            return (
              <label
                key={option.slug}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                  checked
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-zinc-300 text-zinc-900 focus-visible:ring-zinc-900"
                  checked={checked}
                  onChange={() => toggleCapability(option.slug)}
                  onBlur={() => touch("capabilities")}
                />
                <span className="text-zinc-800">{option.label}</span>
              </label>
            );
          })}
        </div>
        {showError("capabilities") ? (
          <p className={FIELD_ERROR_CLASS}>{showError("capabilities")}</p>
        ) : null}
      </fieldset>

      {submitError ? <p className={ADMIN_ACTION_ERROR_CLASS}>{submitError}</p> : null}
      {successMessage ? (
        <p className="text-sm font-medium text-emerald-800" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="flex justify-end border-t border-zinc-100 pt-4">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!validation.valid || submitting}
        >
          {submitting ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
