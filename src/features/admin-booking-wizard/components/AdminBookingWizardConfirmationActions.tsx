"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import {
  createAdminPendingPaymentBooking,
  generateAdminPaymentLink,
  saveAdminBookingDraft,
  sendAdminPaymentRequestNotification,
} from "../api";
import {
  buildAdminDraftRequestBody,
  isAdminDraftFormReadyForSave,
  type AdminBookingWizardFormState,
} from "../draftFormState";
import { formatAdminQuoteZar } from "../pricingApi";
import { WIZARD_BTN_PRIMARY, WIZARD_BTN_SECONDARY } from "@/features/booking-wizard/wizardTheme";

type Props = {
  featureEnabled: boolean;
  paymentLinksEnabled: boolean;
  form: AdminBookingWizardFormState;
};

export function AdminBookingWizardConfirmationActions({
  featureEnabled,
  paymentLinksEnabled,
  form,
}: Props) {
  const draftIdempotencyRef = useRef<string>(crypto.randomUUID());
  const pendingIdempotencyRef = useRef<string>(crypto.randomUUID());
  const paymentLinkIdempotencyRef = useRef<string>(crypto.randomUUID());
  const sendEmailIdempotencyRef = useRef<string>(crypto.randomUUID());
  const whatsappIdempotencyRef = useRef<string>(crypto.randomUUID());
  const errorId = useId();
  const [saving, setSaving] = useState(false);
  const [pendingSaving, setPendingSaving] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [saved, setSaved] = useState<{
    bookingId: string;
    customerId: string;
    priceCents: number;
  } | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{
    bookingId: string;
  } | null>(null);
  const [paymentLink, setPaymentLink] = useState<{
    paymentUrl: string;
    reference: string;
    expiresAt: string;
  } | null>(null);

  const canSaveDraft =
    featureEnabled && isAdminDraftFormReadyForSave(form) && !saving && !saved && !pendingPayment;

  const canCreateUnpaid =
    featureEnabled &&
    Boolean(saved?.bookingId) &&
    !pendingSaving &&
    !pendingPayment &&
    Boolean(form.selectedCustomer?.customerId);

  const activeBookingId = pendingPayment?.bookingId ?? saved?.bookingId;
  const canSendPaymentRequest =
    paymentLinksEnabled &&
    Boolean(pendingPayment?.bookingId) &&
    Boolean(form.selectedCustomer?.customerId) &&
    !linkSaving &&
    !paymentLink;

  const onSaveDraft = useCallback(async () => {
    const body = buildAdminDraftRequestBody(form, draftIdempotencyRef.current);
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

  const onCreateUnpaid = useCallback(async () => {
    if (!saved?.bookingId || !form.selectedCustomer?.customerId) {
      setError("Save a draft booking first.");
      return;
    }

    setPendingSaving(true);
    setError(null);
    try {
      const result = await createAdminPendingPaymentBooking(saved.bookingId, {
        customerId: form.selectedCustomer.customerId,
        idempotencyKey: pendingIdempotencyRef.current,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPendingPayment({ bookingId: result.booking.bookingId });
    } catch {
      setError("Could not create unpaid booking. Try again.");
    } finally {
      setPendingSaving(false);
    }
  }, [form.selectedCustomer?.customerId, saved?.bookingId]);

  const onSendPaymentRequest = useCallback(async () => {
    const bookingId = pendingPayment?.bookingId;
    if (!bookingId || !form.selectedCustomer?.customerId) {
      setError("Create an unpaid booking before sending a payment request.");
      return;
    }

    setLinkSaving(true);
    setError(null);
    try {
      const result = await generateAdminPaymentLink(bookingId, {
        customerId: form.selectedCustomer.customerId,
        idempotencyKey: paymentLinkIdempotencyRef.current,
        deliveryChannel: "copy_only",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPaymentLink({
        paymentUrl: result.paymentLink.paymentUrl,
        reference: result.paymentLink.reference,
        expiresAt: result.paymentLink.expiresAt,
      });
    } catch {
      setError("Could not generate payment link.");
    } finally {
      setLinkSaving(false);
    }
  }, [form.selectedCustomer?.customerId, pendingPayment?.bookingId]);

  const onCopyLink = useCallback(async () => {
    if (!paymentLink?.paymentUrl) return;
    try {
      await navigator.clipboard.writeText(paymentLink.paymentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link to clipboard.");
    }
  }, [paymentLink?.paymentUrl]);

  const onSendEmailRequest = useCallback(async () => {
    const bookingId = pendingPayment?.bookingId;
    if (!bookingId || !form.selectedCustomer?.customerId) {
      setError("Create an unpaid booking with a payment link first.");
      return;
    }
    setNotifyLoading(true);
    setError(null);
    try {
      const result = await sendAdminPaymentRequestNotification(bookingId, {
        customerId: form.selectedCustomer.customerId,
        deliveryChannel: "email",
        idempotencyKey: sendEmailIdempotencyRef.current,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
    } catch {
      setError("Could not send payment request email.");
    } finally {
      setNotifyLoading(false);
    }
  }, [form.selectedCustomer?.customerId, pendingPayment?.bookingId]);

  const onCopyWhatsAppMessage = useCallback(async () => {
    const bookingId = pendingPayment?.bookingId;
    if (!bookingId || !form.selectedCustomer?.customerId) {
      setError("Create an unpaid booking with a payment link first.");
      return;
    }
    whatsappIdempotencyRef.current = crypto.randomUUID();
    setNotifyLoading(true);
    setError(null);
    try {
      const result = await sendAdminPaymentRequestNotification(bookingId, {
        customerId: form.selectedCustomer.customerId,
        deliveryChannel: "whatsapp_copy",
        idempotencyKey: whatsappIdempotencyRef.current,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const text = result.notification.copiedText;
      if (!text) {
        setError("Could not build WhatsApp message.");
        return;
      }
      await navigator.clipboard.writeText(text);
      setWhatsappCopied(true);
      window.setTimeout(() => setWhatsappCopied(false), 2000);
    } catch {
      setError("Could not copy WhatsApp message.");
    } finally {
      setNotifyLoading(false);
    }
  }, [form.selectedCustomer?.customerId, pendingPayment?.bookingId]);

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
      <button
        type="button"
        disabled={!canCreateUnpaid}
        onClick={onCreateUnpaid}
        className={`min-h-11 rounded-xl px-4 text-sm font-medium ${
          canCreateUnpaid ? WIZARD_BTN_SECONDARY : "border border-slate-200 bg-slate-100 text-slate-500"
        }`}
        data-testid="admin-booking-create-unpaid"
      >
        {pendingSaving ? "Creating…" : "Create unpaid booking"}
      </button>
      {pendingPayment ? (
        <p
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
          data-testid="admin-booking-pending-payment-success"
        >
          Booking is now pending payment.
        </p>
      ) : null}
      <button
        type="button"
        disabled={!canSendPaymentRequest}
        onClick={onSendPaymentRequest}
        className={`min-h-11 rounded-xl px-4 text-sm font-medium ${
          canSendPaymentRequest
            ? WIZARD_BTN_SECONDARY
            : "border border-slate-200 bg-slate-100 text-slate-500"
        }`}
        data-testid="admin-booking-send-payment-request"
      >
        {linkSaving ? "Generating…" : "Send payment request"}
      </button>
      {paymentLink ? (
        <div
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900"
          data-testid="admin-booking-payment-link-success"
        >
          <p className="font-medium">Payment request sent</p>
          <p className="mt-1 text-xs">Share this Paystack link with the customer.</p>
          <a
            href={paymentLink.paymentUrl}
            className="mt-2 block break-all text-sm font-medium underline-offset-2 hover:underline"
            data-testid="admin-booking-payment-link-url"
          >
            {paymentLink.paymentUrl}
          </a>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onCopyLink()}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium"
              data-testid="admin-booking-payment-link-copy"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            {paymentLinksEnabled && form.selectedCustomer?.email?.trim() ? (
              <button
                type="button"
                disabled={notifyLoading}
                onClick={() => void onSendEmailRequest()}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                data-testid="admin-booking-payment-request-send-email"
              >
                {notifyLoading ? "Sending…" : "Send email request"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={notifyLoading}
              onClick={() => void onCopyWhatsAppMessage()}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              data-testid="admin-booking-payment-request-copy-whatsapp"
            >
              {whatsappCopied ? "Copied" : "Copy WhatsApp message"}
            </button>
            {activeBookingId ? (
              <Link
                href={`/admin/bookings/${activeBookingId}`}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium underline-offset-2 hover:underline"
                data-testid="admin-booking-payment-link-booking-detail"
              >
                View booking
              </Link>
            ) : null}
          </div>
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
        data-testid="admin-booking-finalize-paid"
      >
        Finalize paid booking
      </button>
    </div>
  );
}
