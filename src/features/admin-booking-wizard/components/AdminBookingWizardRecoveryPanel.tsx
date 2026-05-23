"use client";

import { useCallback, useRef, useState } from "react";
import {
  generateAdminPaymentLink,
  sendAdminPaymentRequestNotification,
} from "../api";
import type { AdminBookingFlowSnapshot } from "../adminBookingFlowState";
import type { AdminBookingWizardFormState } from "../draftFormState";
import { WIZARD_BTN_SECONDARY } from "@/features/booking-wizard/wizardTheme";

type Props = {
  paymentLinksEnabled: boolean;
  form: AdminBookingWizardFormState;
  flow: AdminBookingFlowSnapshot;
  onFlowChange: (flow: AdminBookingFlowSnapshot) => void;
  onFlowRefresh?: () => Promise<void>;
};

export function AdminBookingWizardRecoveryPanel({
  paymentLinksEnabled,
  form,
  flow,
  onFlowChange,
  onFlowRefresh,
}: Props) {
  const regenerateRef = useRef(crypto.randomUUID());
  const resendEmailRef = useRef(crypto.randomUUID());
  const whatsappRef = useRef(crypto.randomUUID());
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const server = flow.serverStatus;
  const bookingId = flow.pendingPayment?.bookingId ?? flow.saved?.bookingId;
  const customerId = form.selectedCustomer?.customerId;

  const showExpired = Boolean(server?.paymentLinkExpired && paymentLinksEnabled);
  const showResendEmail =
    Boolean(server?.failedEmailNotification && server?.customerHasEmail && paymentLinksEnabled);
  const showWhatsApp =
    Boolean(
      !server?.customerHasEmail &&
        !form.selectedCustomer?.email?.trim() &&
        flow.paymentLink?.paymentUrl &&
        paymentLinksEnabled,
    );
  const showStaleBadge = Boolean(server?.pendingPaymentStale);

  const onRegenerate = useCallback(async () => {
    if (!bookingId || !customerId) return;
    regenerateRef.current = crypto.randomUUID();
    setLoading("regenerate");
    setError(null);
    try {
      const result = await generateAdminPaymentLink(bookingId, {
        customerId,
        idempotencyKey: regenerateRef.current,
        deliveryChannel: "copy_only",
        regenerate: true,
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
      setError("Could not regenerate payment link.");
    } finally {
      setLoading(null);
    }
  }, [bookingId, customerId, flow, onFlowChange, onFlowRefresh]);

  const onResendEmail = useCallback(async () => {
    if (!bookingId || !customerId) return;
    resendEmailRef.current = crypto.randomUUID();
    setLoading("email");
    setError(null);
    try {
      const result = await sendAdminPaymentRequestNotification(bookingId, {
        customerId,
        deliveryChannel: "email",
        idempotencyKey: resendEmailRef.current,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onFlowChange({ ...flow, emailRequestSent: true });
      await onFlowRefresh?.();
    } catch {
      setError("Could not resend payment request email.");
    } finally {
      setLoading(null);
    }
  }, [bookingId, customerId, flow, onFlowChange, onFlowRefresh]);

  const onCopyWhatsApp = useCallback(async () => {
    if (!bookingId || !customerId) return;
    whatsappRef.current = crypto.randomUUID();
    setLoading("whatsapp");
    setError(null);
    try {
      const result = await sendAdminPaymentRequestNotification(bookingId, {
        customerId,
        deliveryChannel: "whatsapp_copy",
        idempotencyKey: whatsappRef.current,
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
      setLoading(null);
    }
  }, [bookingId, customerId, flow, onFlowChange, onFlowRefresh]);

  if (
    !bookingId ||
    (!showExpired && !showResendEmail && !showWhatsApp && !showStaleBadge && !server?.nextRecommendedAction)
  ) {
    return null;
  }

  return (
    <section
      className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"
      data-testid="admin-booking-recovery-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-amber-950">Operator recovery</p>
        {showStaleBadge ? (
          <span
            className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
            data-testid="admin-booking-stale-pending-badge"
          >
            Pending &gt;72h — needs attention
          </span>
        ) : null}
      </div>

      {server?.nextRecommendedAction ? (
        <p className="text-xs text-amber-900" data-testid="admin-booking-next-recommended-action">
          <span className="font-medium">{server.nextRecommendedAction.label}:</span>{" "}
          {server.nextRecommendedAction.reason}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {showExpired ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void onRegenerate()}
            className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium ${WIZARD_BTN_SECONDARY}`}
            data-testid="admin-booking-recovery-regenerate-link"
          >
            {loading === "regenerate" ? "Regenerating…" : "Regenerate expired link"}
          </button>
        ) : null}
        {showResendEmail ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void onResendEmail()}
            className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium ${WIZARD_BTN_SECONDARY}`}
            data-testid="admin-booking-recovery-resend-email"
          >
            {loading === "email" ? "Sending…" : "Resend payment email"}
          </button>
        ) : null}
        {showWhatsApp ? (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => void onCopyWhatsApp()}
            className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium ${WIZARD_BTN_SECONDARY}`}
            data-testid="admin-booking-recovery-copy-whatsapp"
          >
            {loading === "whatsapp" ? "Copying…" : "Copy WhatsApp message"}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
