"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import { saveAdminBookingDraft } from "../api";
import {
  buildAdminDraftRequestBody,
  isAdminDraftFormReadyForSave,
  type AdminBookingWizardFormState,
} from "../draftFormState";
import { formatAdminQuoteZar } from "../pricingApi";
import { WIZARD_BTN_PRIMARY } from "@/features/booking-wizard/wizardTheme";

type Props = {
  featureEnabled: boolean;
  form: AdminBookingWizardFormState;
};

export function AdminBookingWizardConfirmationActions({ featureEnabled, form }: Props) {
  const idempotencyRef = useRef<string>(crypto.randomUUID());
  const errorId = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    bookingId: string;
    customerId: string;
    priceCents: number;
  } | null>(null);

  const canSaveDraft = featureEnabled && isAdminDraftFormReadyForSave(form) && !saving && !saved;

  const onSaveDraft = useCallback(async () => {
    const body = buildAdminDraftRequestBody(form, idempotencyRef.current);
    if (!body) {
      setError("Complete customer, service, schedule, and address before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await saveAdminBookingDraft(body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved({
        bookingId: result.bookingDraft.bookingId,
        customerId: form.selectedCustomer?.customerId ?? body.customerId,
        priceCents: result.bookingDraft.priceCents,
      });
    } catch {
      setError("Could not save draft. Try again.");
    } finally {
      setSaving(false);
    }
  }, [form]);

  return (
    <div className="flex flex-col gap-2" data-testid="admin-booking-confirmation-actions">
      <button
        type="button"
        disabled={!canSaveDraft}
        onClick={onSaveDraft}
        className={`min-h-11 rounded-xl px-4 text-sm font-medium ${WIZARD_BTN_PRIMARY}`}
        data-testid="admin-booking-save-draft"
      >
        {saving ? "Saving…" : "Save draft"}
      </button>
      {saved ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900"
          data-testid="admin-booking-save-draft-success"
        >
          <p className="font-medium">Draft saved</p>
          <p className="mt-1 text-xs">
            Status: draft · Server total {formatAdminQuoteZar(saved.priceCents)}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>
              <Link
                href={`/admin/bookings/${saved.bookingId}`}
                className="font-medium underline-offset-2 hover:underline"
                data-testid="admin-booking-success-booking-link"
              >
                View booking
              </Link>
            </li>
            <li>
              <Link
                href={`/admin/customers/${saved.customerId}`}
                className="font-medium underline-offset-2 hover:underline"
                data-testid="admin-booking-success-customer-link"
              >
                View customer
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled
        className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
      >
        Create unpaid booking
      </button>
      <button
        type="button"
        disabled
        className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
      >
        Finalize paid booking
      </button>
      <button
        type="button"
        disabled
        className="min-h-11 rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
      >
        Send payment request
      </button>
    </div>
  );
}
