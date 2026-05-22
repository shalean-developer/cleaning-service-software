"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";
import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import { defaultCleanerAvailabilityFormValues } from "@/features/cleaners/admin/cleanerAvailability";
import { CLEANER_CAPABILITY_OPTIONS } from "@/features/cleaners/admin/cleanerCapabilityOptions";
import { AdminServiceAreasTextarea } from "@/components/dashboard/admin/AdminServiceAreasTextarea";
import { CleanerAvailabilityFields } from "@/components/dashboard/admin/CleanerAvailabilityFields";
import {
  CLEANER_CREATE_MIN_PASSWORD_LENGTH,
  parseServiceAreasInput,
  validateCleanerCreateForm,
  type CleanerCreateFormErrors,
  type CleanerCreateFormField,
} from "@/features/cleaners/admin/cleanerProfileFormValidation";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { ADMIN_SECTION_MUTED_CLASS } from "@/features/dashboards/adminDisplay";

export const CLEANER_CREATE_API_ENABLED = true;

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

const READONLY_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700";

const INPUT_ERROR_CLASS = "border-red-300 focus-visible:ring-red-600";

const FIELD_ERROR_CLASS = "mt-1 text-xs text-red-700";

function fieldClass(hasError: boolean): string {
  return hasError ? `${INPUT_CLASS} ${INPUT_ERROR_CLASS}` : INPUT_CLASS;
}

const EMPTY_VALUES = {
  fullName: "",
  phone: "",
  password: "",
  confirmPassword: "",
  serviceAreasInput: "",
  capabilities: [] as ServiceSlug[],
  ...defaultCleanerAvailabilityFormValues(),
};

export type AdminCleanerCreateFormProps = {
  initialFullName?: string;
  initialPhone?: string;
};

export function AdminCleanerCreateForm({
  initialFullName = "",
  initialPhone = "",
}: AdminCleanerCreateFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    ...EMPTY_VALUES,
    fullName: initialFullName,
    phone: initialPhone,
  });
  const [errors, setErrors] = useState<CleanerCreateFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<CleanerCreateFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validation = useMemo(() => validateCleanerCreateForm(values), [values]);
  const loginEmailPreview = useMemo(
    () => buildShaleanCleanerAuthEmail(values.phone),
    [values.phone],
  );
  const normalizedAreas = useMemo(
    () => parseServiceAreasInput(values.serviceAreasInput),
    [values.serviceAreasInput],
  );

  function showError(field: CleanerCreateFormField): string | undefined {
    if (!submitAttempted && !touched[field]) return undefined;
    return errors[field] ?? validation.errors[field];
  }

  function touch(field: CleanerCreateFormField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function runValidation(): boolean {
    const result = validateCleanerCreateForm(values);
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

    if (!runValidation()) return;

    if (!CLEANER_CREATE_API_ENABLED) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/cleaners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          phone: values.phone,
          password: values.password,
          confirmPassword: values.confirmPassword,
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
        cleanerId?: string;
        message?: string;
        error?: string;
      };

      if (!response.ok || !result.ok || !result.cleanerId) {
        setSubmitError(result.message ?? result.error ?? "Failed to create cleaner.");
        return;
      }

      router.push(`/admin/cleaners/${result.cleanerId}`);
      router.refresh();
    } catch {
      setSubmitError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const formValid = validation.valid;
  const createDisabled =
    !CLEANER_CREATE_API_ENABLED || !formValid || submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Cleaners can sign in with their mobile number or generated Shalean email. Profile details
        only. operational lifecycle (activate, suspend, archive) is managed from the cleaner
        detail page after creation.
      </p>

      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Password is set by admin now and cannot be shown again after account creation.
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
            aria-describedby={showError("fullName") ? "fullName-error" : undefined}
          />
          {showError("fullName") ? (
            <p id="fullName-error" className={FIELD_ERROR_CLASS}>
              {showError("fullName")}
            </p>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Phone number</span>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            placeholder="e.g. 079 202 2648"
            className={fieldClass(Boolean(showError("phone")))}
            value={values.phone}
            onChange={(e) => setValues((prev) => ({ ...prev, phone: e.target.value }))}
            onBlur={() => touch("phone")}
            aria-invalid={Boolean(showError("phone"))}
            aria-describedby="phone-hint phone-error"
          />
          <p id="phone-hint" className="mt-1 text-xs text-zinc-500">
            South African mobile number used for login and contact.
          </p>
          {showError("phone") ? (
            <p id="phone-error" className={FIELD_ERROR_CLASS}>
              {showError("phone")}
            </p>
          ) : null}
        </label>

        <div className="block text-sm">
          <span className="font-medium text-zinc-800">Login email</span>
          <output
            id="login-email-preview"
            className={READONLY_CLASS}
            aria-live="polite"
            aria-label="Generated login email preview"
          >
            {loginEmailPreview ?? "Enter a valid mobile number"}
          </output>
          <p className="mt-1 text-xs text-zinc-500">
            Generated automatically as {"{localPhone}"}@shalean.co.za. not editable.
          </p>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            className={fieldClass(Boolean(showError("password")))}
            value={values.password}
            onChange={(e) => setValues((prev) => ({ ...prev, password: e.target.value }))}
            onBlur={() => touch("password")}
            aria-invalid={Boolean(showError("password"))}
            aria-describedby="password-hint password-error"
          />
          <p id="password-hint" className="mt-1 text-xs text-zinc-500">
            At least {CLEANER_CREATE_MIN_PASSWORD_LENGTH} characters.
          </p>
          {showError("password") ? (
            <p id="password-error" className={FIELD_ERROR_CLASS}>
              {showError("password")}
            </p>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="font-medium text-zinc-800">Confirm password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            className={fieldClass(Boolean(showError("confirmPassword")))}
            value={values.confirmPassword}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, confirmPassword: e.target.value }))
            }
            onBlur={() => touch("confirmPassword")}
            aria-invalid={Boolean(showError("confirmPassword"))}
            aria-describedby={
              showError("confirmPassword") ? "confirm-password-error" : undefined
            }
          />
          {showError("confirmPassword") ? (
            <p id="confirm-password-error" className={FIELD_ERROR_CLASS}>
              {showError("confirmPassword")}
            </p>
          ) : null}
        </label>

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
          <p id="service-areas-hint" className="mt-1 text-xs text-zinc-500">
            Leave empty to match all areas. Slugs are normalized automatically.
          </p>
          {normalizedAreas.length > 0 ? (
            <p className="mt-1 text-xs text-zinc-600">
              Preview: {normalizedAreas.join(", ")}
            </p>
          ) : null}
          {showError("serviceAreasInput") ? (
            <p id="service-areas-error" className={FIELD_ERROR_CLASS}>
              {showError("serviceAreasInput")}
            </p>
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
        <p className="mt-0.5 text-xs text-zinc-500">
          Required. cleaners with no capabilities are not eligible for assignment.
        </p>
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

      <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href="/admin/cleaners"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={createDisabled}
          title={!formValid ? "Fix validation errors to continue" : undefined}
        >
          {submitting ? "Creating…" : "Create cleaner"}
        </button>
      </div>
    </form>
  );
}
