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

type FormField = "email" | "fullName" | "companyName" | "phone" | "notes";

type FormErrors = Partial<Record<FormField, string>>;

type FormValues = {
  email: string;
  fullName: string;
  companyName: string;
  phone: string;
  notes: string;
};

const EMPTY_VALUES: FormValues = {
  email: "",
  fullName: "",
  companyName: "",
  phone: "",
  notes: "",
};

function fieldClass(hasError: boolean): string {
  return hasError ? `${INPUT_CLASS} ${INPUT_ERROR_CLASS}` : INPUT_CLASS;
}

function validate(values: FormValues): { valid: boolean; errors: FormErrors } {
  const errors: FormErrors = {};
  const email = values.email.trim();
  const fullName = values.fullName.trim();

  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!fullName) {
    errors.fullName = "Full name is required.";
  } else if (fullName.length > 200) {
    errors.fullName = "Full name is too long.";
  }

  if (values.companyName.trim().length > 200) {
    errors.companyName = "Company name is too long.";
  }

  if (values.phone.trim() && !isValidZaMobilePhone(values.phone)) {
    errors.phone = "Enter a valid South African mobile number (e.g. 082 123 4567).";
  }

  if (values.notes.trim().length > 2000) {
    errors.notes = "Notes are too long.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function AdminCustomerCreateForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY_VALUES);
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
      const response = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email.trim(),
          full_name: values.fullName.trim(),
          company_name: values.companyName.trim() || undefined,
          phone: values.phone.trim() || undefined,
          notes: values.notes.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        customer?: { customerId?: string };
      };

      if (!response.ok || !payload.ok || !payload.customer?.customerId) {
        setSubmitError(payload.message ?? "Could not create customer. Try again.");
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
      <div>
        <label htmlFor="customer-email" className="block text-sm font-medium text-zinc-900">
          Email
        </label>
        <input
          id="customer-email"
          name="email"
          type="email"
          autoComplete="email"
          className={fieldClass(Boolean(showError("email")))}
          value={values.email}
          onChange={(e) => setValues((prev) => ({ ...prev, email: e.target.value }))}
          onBlur={() => touch("email")}
          disabled={submitting}
        />
        {showError("email") ? <p className={FIELD_ERROR_CLASS}>{showError("email")}</p> : null}
      </div>

      <div>
        <label htmlFor="customer-full-name" className="block text-sm font-medium text-zinc-900">
          Full name
        </label>
        <input
          id="customer-full-name"
          name="fullName"
          type="text"
          autoComplete="name"
          className={fieldClass(Boolean(showError("fullName")))}
          value={values.fullName}
          onChange={(e) => setValues((prev) => ({ ...prev, fullName: e.target.value }))}
          onBlur={() => touch("fullName")}
          disabled={submitting}
        />
        {showError("fullName") ? (
          <p className={FIELD_ERROR_CLASS}>{showError("fullName")}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="customer-company" className="block text-sm font-medium text-zinc-900">
          Company name
          <span className="font-normal text-zinc-500"> (optional)</span>
        </label>
        <input
          id="customer-company"
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
        <label htmlFor="customer-phone" className="block text-sm font-medium text-zinc-900">
          Phone
          <span className="font-normal text-zinc-500"> (optional)</span>
        </label>
        <input
          id="customer-phone"
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
        <label htmlFor="customer-notes" className="block text-sm font-medium text-zinc-900">
          Notes
          <span className="font-normal text-zinc-500"> (optional)</span>
        </label>
        <textarea
          id="customer-notes"
          name="notes"
          rows={3}
          className={fieldClass(Boolean(showError("notes")))}
          value={values.notes}
          onChange={(e) => setValues((prev) => ({ ...prev, notes: e.target.value }))}
          onBlur={() => touch("notes")}
          disabled={submitting}
        />
        {showError("notes") ? <p className={FIELD_ERROR_CLASS}>{showError("notes")}</p> : null}
      </div>

      <p className={ADMIN_SECTION_MUTED_CLASS}>
        Accounts are created with a confirmed email. Password reset and invite flows are not
        available from this form yet.
      </p>

      {submitError ? <p className={ADMIN_ACTION_ERROR_CLASS}>{submitError}</p> : null}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create customer"}
        </button>
        <Link
          href="/admin/customers"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
