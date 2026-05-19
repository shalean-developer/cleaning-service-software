"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { ADMIN_ACTION_ERROR_CLASS } from "@/lib/app/dashboardEcosystemDisplay";
import { isValidZaMobilePhone } from "@/lib/validation/zaPhone";
import { ADMIN_SECTION_MUTED_CLASS } from "@/features/dashboards/adminDisplay";

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

const INPUT_ERROR_CLASS = "border-red-300 focus-visible:ring-red-600";

const FIELD_ERROR_CLASS = "mt-1 text-xs text-red-700";

type FormField = "companyName" | "phone" | "notes";

type FormErrors = Partial<Record<FormField, string>>;

export type AdminCustomerEditInitialValues = {
  customerId: string;
  companyName: string;
  phone: string;
  notes: string;
};

type Props = {
  initial: AdminCustomerEditInitialValues;
};

function fieldClass(hasError: boolean): string {
  return hasError ? `${INPUT_CLASS} ${INPUT_ERROR_CLASS}` : INPUT_CLASS;
}

function validate(values: { companyName: string; phone: string; notes: string }): {
  valid: boolean;
  errors: FormErrors;
} {
  const errors: FormErrors = {};
  const companyName = values.companyName.trim();

  if (!companyName) {
    errors.companyName = "Company name is required.";
  } else if (companyName.length > 200) {
    errors.companyName = "Company name is too long.";
  }

  if (values.phone.trim() && !isValidZaMobilePhone(values.phone)) {
    errors.phone = "Enter a valid South African mobile number (e.g. 082 123 4567).";
  }

  if (values.notes.length > 2000) {
    errors.notes = "Notes are too long.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function AdminCustomerEditForm({ initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState({
    companyName: initial.companyName,
    phone: initial.phone,
    notes: initial.notes,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validation = useMemo(() => validate(values), [values]);

  function showError(field: FormField): string | undefined {
    if (!submitAttempted && !touched[field]) return undefined;
    return errors[field] ?? validation.errors[field];
  }

  function touch(field: FormField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function runValidation(): boolean {
    const result = validate(values);
    setErrors(result.errors);
    return result.valid;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);

    if (!runValidation()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/customers/${initial.customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: values.companyName.trim(),
          phone: values.phone.trim() ? values.phone.trim() : null,
          notes: values.notes.trim() ? values.notes.trim() : null,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        customer?: { customerId?: string };
      };

      if (!response.ok || !payload.ok || !payload.customer?.customerId) {
        setSubmitError(payload.message ?? "Could not save changes. Try again.");
        return;
      }

      router.push(`/admin/customers/${payload.customer.customerId}`);
      router.refresh();
    } catch {
      setSubmitError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Login email and booking ownership cannot be changed here.
      </p>

      <div>
        <label htmlFor="edit-company-name" className="block text-sm font-medium text-zinc-900">
          Company name
        </label>
        <input
          id="edit-company-name"
          name="companyName"
          type="text"
          className={fieldClass(Boolean(showError("companyName")))}
          value={values.companyName}
          onChange={(e) => setValues((prev) => ({ ...prev, companyName: e.target.value }))}
          onBlur={() => touch("companyName")}
          disabled={submitting}
        />
        {showError("companyName") ? (
          <p className={FIELD_ERROR_CLASS}>{showError("companyName")}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="edit-phone" className="block text-sm font-medium text-zinc-900">
          Phone
          <span className="font-normal text-zinc-500"> (optional)</span>
        </label>
        <input
          id="edit-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="082 123 4567"
          className={fieldClass(Boolean(showError("phone")))}
          value={values.phone}
          onChange={(e) => setValues((prev) => ({ ...prev, phone: e.target.value }))}
          onBlur={() => touch("phone")}
          disabled={submitting}
        />
        {showError("phone") ? <p className={FIELD_ERROR_CLASS}>{showError("phone")}</p> : null}
      </div>

      <div>
        <label htmlFor="edit-notes" className="block text-sm font-medium text-zinc-900">
          Notes
          <span className="font-normal text-zinc-500"> (optional)</span>
        </label>
        <textarea
          id="edit-notes"
          name="notes"
          rows={4}
          className={fieldClass(Boolean(showError("notes")))}
          value={values.notes}
          onChange={(e) => setValues((prev) => ({ ...prev, notes: e.target.value }))}
          onBlur={() => touch("notes")}
          disabled={submitting}
        />
        {showError("notes") ? <p className={FIELD_ERROR_CLASS}>{showError("notes")}</p> : null}
      </div>

      {submitError ? <p className={ADMIN_ACTION_ERROR_CLASS}>{submitError}</p> : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save changes"}
        </button>
        <Link
          href={`/admin/customers/${initial.customerId}`}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
