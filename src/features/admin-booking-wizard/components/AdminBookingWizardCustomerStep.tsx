"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { isValidZaMobilePhone } from "@/lib/validation/zaPhone";
import { WIZARD_TEXT_MUTED } from "@/features/booking-wizard/wizardTheme";
import {
  createAdminCustomer,
  searchAdminCustomers,
  type AdminCustomerSearchResult,
} from "../adminCustomerApi";
import type { AdminBookingWizardFormState, AdminBookingWizardSelectedCustomer } from "../draftFormState";

type Props = {
  form: AdminBookingWizardFormState;
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void;
  prefillLoading?: boolean;
  prefillError?: string | null;
};

function selectCustomer(
  customer: AdminCustomerSearchResult,
  onFormChange: Props["onFormChange"],
): void {
  const selected: AdminBookingWizardSelectedCustomer = {
    customerId: customer.customerId,
    label: customer.label,
    email: customer.email,
    phone: customer.phone,
  };
  onFormChange({ customerId: customer.customerId, selectedCustomer: selected });
}

export function AdminBookingWizardCustomerStep({
  form,
  onFormChange,
  prefillLoading,
  prefillError,
}: Props) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<AdminCustomerSearchResult[]>([]);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createWarnings, setCreateWarnings] = useState<string[]>([]);

  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setDuplicateWarnings([]);
      setSearchError(trimmed ? "Enter at least 2 characters to search." : null);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const result = await searchAdminCustomers(trimmed);
      if (!result.ok) {
        setResults([]);
        setDuplicateWarnings([]);
        setSearchError(result.message);
        return;
      }
      setResults(result.customers);
      setDuplicateWarnings(result.duplicateWarnings);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, runSearch]);

  const onCreateCustomer = useCallback(async () => {
    const fullName = createName.trim();
    const email = createEmail.trim();
    const phone = createPhone.trim();

    if (!fullName) {
      setCreateError("Full name is required.");
      return;
    }
    if (!email && !phone) {
      setCreateError("Email or phone is required.");
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError("Enter a valid email address.");
      return;
    }
    if (phone && !isValidZaMobilePhone(phone)) {
      setCreateError("Enter a valid South African mobile number (e.g. 082 123 4567).");
      return;
    }

    setCreating(true);
    setCreateError(null);
    setCreateWarnings([]);
    try {
      const result = await createAdminCustomer({
        fullName,
        email: email || undefined,
        phone: phone || undefined,
        notes: createNotes.trim() || undefined,
      });
      if (!result.ok) {
        setCreateError(result.message);
        return;
      }
      setCreateWarnings(result.warnings);
      selectCustomer(result.customer, onFormChange);
      setShowCreate(false);
      setQuery(result.customer.label);
      setResults([result.customer]);
    } finally {
      setCreating(false);
    }
  }, [createEmail, createName, createNotes, createPhone, onFormChange]);

  const selected = form.selectedCustomer;

  return (
    <div data-testid="admin-booking-customer-step">
      {prefillLoading ? (
        <p className="mb-3 text-sm text-slate-600" data-testid="admin-booking-customer-prefill-loading">
          Loading customer profile…
        </p>
      ) : null}
      {prefillError ? (
        <p
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
          data-testid="admin-booking-customer-prefill-step-error"
        >
          {prefillError}
        </p>
      ) : null}
      <label htmlFor={searchId} className={`block text-xs font-medium ${WIZARD_TEXT_MUTED}`}>
        Search by name, email, or phone
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. Jane Smith or jane@example.com"
        className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        data-testid="admin-booking-customer-search"
        autoComplete="off"
      />

      {searching ? (
        <p className="mt-2 text-xs text-slate-500" data-testid="admin-booking-customer-search-loading">
          Searching…
        </p>
      ) : null}
      {searchError ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {searchError}
        </p>
      ) : null}

      {duplicateWarnings.length > 0 ? (
        <ul
          className="mt-2 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          data-testid="admin-booking-customer-duplicate-warnings"
        >
          {duplicateWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {results.length > 0 ? (
        <ul
          className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100"
          data-testid="admin-booking-customer-search-results"
        >
          {results.map((customer) => {
            const isSelected = selected?.customerId === customer.customerId;
            return (
              <li key={customer.customerId}>
                <button
                  type="button"
                  onClick={() => selectCustomer(customer, onFormChange)}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    isSelected ? "bg-slate-100 font-medium" : ""
                  }`}
                  data-testid={`admin-booking-customer-option-${customer.customerId}`}
                >
                  <span className="block text-slate-900">{customer.label}</span>
                  <span className="block text-xs text-slate-500">
                    {[customer.email, customer.phone].filter(Boolean).join(" · ") ||
                      customer.customerId.slice(0, 8)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {selected ? (
        <div
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          data-testid="admin-booking-customer-selected"
        >
          <p className="font-medium">Selected: {selected.label}</p>
          <p className="text-xs">
            {[selected.email, selected.phone].filter(Boolean).join(" · ") ||
              selected.customerId}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Select a customer to continue.</p>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        {!showCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
            data-testid="admin-booking-customer-create-toggle"
          >
            Create new customer
          </button>
        ) : (
          <div className="space-y-3" data-testid="admin-booking-customer-create-form">
            <p className="text-sm font-medium text-slate-800">New customer</p>
            <label className="block text-xs text-slate-500">
              Full name
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                data-testid="admin-booking-customer-create-name"
              />
            </label>
            <label className="block text-xs text-slate-500">
              Email (optional)
              <input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                data-testid="admin-booking-customer-create-email"
              />
            </label>
            <label className="block text-xs text-slate-500">
              Phone {createEmail.trim() ? "(optional)" : "(required if no email)"}
              <input
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                className="mt-1 w-full min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                data-testid="admin-booking-customer-create-phone"
              />
            </label>
            <label className="block text-xs text-slate-500">
              Notes (optional)
              <textarea
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            {createError ? (
              <p className="text-xs text-red-700" role="alert">
                {createError}
              </p>
            ) : null}
            {createWarnings.length > 0 ? (
              <ul className="space-y-1 text-xs text-amber-800">
                {createWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={creating}
                onClick={() => void onCreateCustomer()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                data-testid="admin-booking-customer-create-submit"
              >
                {creating ? "Creating…" : "Create and select"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
