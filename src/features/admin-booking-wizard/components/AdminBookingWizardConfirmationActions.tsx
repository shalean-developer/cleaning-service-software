"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import {
  createAdminPendingPaymentBooking,
  generateAdminPaymentLink,
  saveAdminBookingDraft,
  sendAdminPaymentRequestNotification,
} from "../api";
import { resolveAdminDisabledActionReason } from "../adminActionGuidance";
import type { AdminBookingFlowSnapshot } from "../adminBookingFlowState";
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
  offlinePaymentsEnabled: boolean;
  form: AdminBookingWizardFormState;
  flow: AdminBookingFlowSnapshot;
  onFlowChange: (flow: AdminBookingFlowSnapshot) => void;
  onFlowRefresh?: () => Promise<void>;
};

function DisabledReason({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <p className="text-xs text-slate-500" data-testid="admin-booking-action-disabled-reason">
      {reason}
    </p>
  );
}

export function AdminBookingWizardConfirmationActions({
  featureEnabled,
  paymentLinksEnabled,
  offlinePaymentsEnabled,
  form,
  flow,
  onFlowChange,
  onFlowRefresh,
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
  const [notifyLoading, setNotifyLoading] = useState(false);

  const formReady = isAdminDraftFormReadyForSave(form);
  const hasDraft = Boolean(flow.saved?.bookingId);
  const hasPendingPayment = Boolean(flow.pendingPayment?.bookingId);
  const hasPaymentLink = Boolean(flow.paymentLink?.paymentUrl);

  const canSaveDraft =
    featureEnabled && formReady && !saving && !hasDraft && !hasPendingPayment;

  const canCreateUnpaid =
    featureEnabled && hasDraft && !pendingSaving && !hasPendingPayment && Boolean(form.selectedCustomer?.customerId);

  const activeBookingId = flow.pendingPayment?.bookingId ?? flow.saved?.bookingId;

  const canSendPaymentRequest =
    paymentLinksEnabled && hasPendingPayment && Boolean(form.selectedCustomer?.customerId) && !linkSaving && !hasPaymentLink;

  const actionContext = {
    featureEnabled,
    paymentLinksEnabled,
    offlinePaymentsEnabled,
    formReady,
    hasDraft,
    hasPendingPayment,
    hasPaymentLink,
    hasCustomerEmail: Boolean(form.selectedCustomer?.email?.trim()),
  };

  const saveDraftReason = resolveAdminDisabledActionReason("save_draft", actionContext);
  const createUnpaidReason = resolveAdminDisabledActionReason("create_unpaid", actionContext);
  const paymentLinkReason = resolveAdminDisabledActionReason("generate_payment_link", actionContext);
  const finalizeReason = resolveAdminDisabledActionReason("finalize_paid", actionContext);

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
      onFlowChange({
        ...flow,
        saved: {
          bookingId: result.bookingDraft.bookingId,
          customerId: form.selectedCustomer?.customerId ?? body.customerId,
          priceCents: result.bookingDraft.priceCents,
        },
      });
      await onFlowRefresh?.();
    } catch {
      setError("Could not save draft. Try again.");
    } finally {
      setSaving(false);
    }
  }, [flow, form, onFlowChange, onFlowRefresh]);

  const onCreateUnpaid = useCallback(async () => {
    if (!flow.saved?.bookingId || !form.selectedCustomer?.customerId) {
      setError("Save a draft booking first.");
      return;
    }

    setPendingSaving(true);
    setError(null);
    try {
      const result = await createAdminPendingPaymentBooking(flow.saved.bookingId, {
        customerId: form.selectedCustomer.customerId,
        idempotencyKey: pendingIdempotencyRef.current,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onFlowChange({
        ...flow,
        pendingPayment: { bookingId: result.booking.bookingId },
      });
      await onFlowRefresh?.();
    } catch {
      setError("Could not create unpaid booking. Try again.");
    } finally {
      setPendingSaving(false);
    }
  }, [flow, form.selectedCustomer?.customerId, onFlowChange, onFlowRefresh]);

  const onSendPaymentRequest = useCallback(async () => {
    const bookingId = flow.pendingPayment?.bookingId;
    if (!bookingId || !form.selectedCustomer?.customerId) {
      setError("Create an unpaid booking before generating this payment request.");
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
      onFlowChange({
        ...flow,
        paymentLink: {
          paymentUrl: result.paymentLink.paymentUrl,
          reference: result.paymentLink.reference,
          expiresAt: result.paymentLink.expiresAt,
        },
      });
      await onFlowRefresh?.();
    } catch {
      setError("Could not generate payment link.");
    } finally {
      setLinkSaving(false);
    }
  }, [flow, form.selectedCustomer?.customerId, onFlowChange, onFlowRefresh]);

  const onCopyLink = useCallback(async () => {
    if (!flow.paymentLink?.paymentUrl) return;
    try {
      await navigator.clipboard.writeText(flow.paymentLink.paymentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link to clipboard.");
    }
  }, [flow.paymentLink?.paymentUrl]);

  const onSendEmailRequest = useCallback(async () => {
    const bookingId = flow.pendingPayment?.bookingId;
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
      onFlowChange({ ...flow, emailRequestSent: true });
      await onFlowRefresh?.();
    } catch {
      setError("Could not send payment request email.");
    } finally {
      setNotifyLoading(false);
    }
  }, [flow, form.selectedCustomer?.customerId, onFlowChange, onFlowRefresh]);

  const onCopyWhatsAppMessage = useCallback(async () => {
    const bookingId = flow.pendingPayment?.bookingId;
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
      onFlowChange({ ...flow, whatsappCopied: true });
      await onFlowRefresh?.();
    } catch {
      setError("Could not copy WhatsApp message.");
    } finally {
      setNotifyLoading(false);
    }
  }, [flow, form.selectedCustomer?.customerId, onFlowChange, onFlowRefresh]);

  return (
    <div
      className="flex flex-col gap-3 md:gap-2"
      data-testid="admin-booking-confirmation-actions"
    >
      <section className="space-y-2 rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary actions</p>
        <button
          type="button"
          disabled={!canSaveDraft}
          onClick={() => void onSaveDraft()}
          className={`min-h-11 w-full rounded-xl px-4 text-sm font-medium ${WIZARD_BTN_PRIMARY}`}
          data-testid="admin-booking-save-draft"
        >
          {saving ? "Saving…" : "1. Save draft"}
        </button>
        {!canSaveDraft ? <DisabledReason reason={saveDraftReason} /> : null}

        {flow.saved ? (
          <div
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900"
            data-testid="admin-booking-save-draft-success"
          >
            <p className="font-medium">Draft saved</p>
            <p className="mt-1 text-xs">
              Server total {formatAdminQuoteZar(flow.saved.priceCents)} — authoritative quote
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>
                <Link
                  href={`/admin/bookings/${flow.saved.bookingId}`}
                  className="font-medium underline-offset-2 hover:underline"
                  data-testid="admin-booking-success-booking-link"
                >
                  View booking
                </Link>
              </li>
              <li>
                <Link
                  href={`/admin/customers/${flow.saved.customerId}`}
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
          onClick={() => void onCreateUnpaid()}
          className={`min-h-11 w-full rounded-xl px-4 text-sm font-medium ${
            canCreateUnpaid ? WIZARD_BTN_SECONDARY : "border border-slate-200 bg-slate-100 text-slate-500"
          }`}
          data-testid="admin-booking-create-unpaid"
        >
          {pendingSaving ? "Creating…" : "2. Create unpaid booking"}
        </button>
        {!canCreateUnpaid ? <DisabledReason reason={createUnpaidReason} /> : null}

        {flow.pendingPayment ? (
          <p
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900"
            data-testid="admin-booking-pending-payment-success"
          >
            Pending payment booking created.
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canSendPaymentRequest}
          onClick={() => void onSendPaymentRequest()}
          className={`min-h-11 w-full rounded-xl px-4 text-sm font-medium ${
            canSendPaymentRequest
              ? WIZARD_BTN_SECONDARY
              : "border border-slate-200 bg-slate-100 text-slate-500"
          }`}
          data-testid="admin-booking-send-payment-request"
        >
          {linkSaving ? "Generating…" : "3. Generate payment link"}
        </button>
        {!canSendPaymentRequest ? <DisabledReason reason={paymentLinkReason} /> : null}
      </section>

      {flow.paymentLink ? (
        <section
          className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"
          data-testid="admin-booking-payment-link-success"
        >
          <p className="font-medium">Payment link ready</p>
          <p className="text-xs">Share this Paystack link with the customer.</p>
          <a
            href={flow.paymentLink.paymentUrl}
            className="block break-all text-sm font-medium underline-offset-2 hover:underline"
            data-testid="admin-booking-payment-link-url"
          >
            {flow.paymentLink.paymentUrl}
          </a>
          <p className="text-xs text-sky-800">
            Expires {new Date(flow.paymentLink.expiresAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onCopyLink()}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium"
              data-testid="admin-booking-payment-link-copy"
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
            {paymentLinksEnabled && form.selectedCustomer?.email?.trim() ? (
              <button
                type="button"
                disabled={notifyLoading}
                onClick={() => void onSendEmailRequest()}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                data-testid="admin-booking-payment-request-send-email"
              >
                {notifyLoading ? "Sending…" : flow.emailRequestSent ? "Email sent" : "Send email request"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={notifyLoading}
              onClick={() => void onCopyWhatsAppMessage()}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              data-testid="admin-booking-payment-request-copy-whatsapp"
            >
              {flow.whatsappCopied ? "WhatsApp copied" : "Copy WhatsApp message"}
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
          {flow.emailRequestSent ? (
            <p className="text-xs font-medium text-emerald-800" data-testid="admin-booking-email-sent-success">
              Payment request email sent.
            </p>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section className="border-t border-slate-200 pt-3">
        <button
          type="button"
          disabled
          className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-500"
          data-testid="admin-booking-finalize-paid"
        >
          Finalize paid booking
        </button>
        <DisabledReason reason={finalizeReason} />
      </section>
    </div>
  );
}
