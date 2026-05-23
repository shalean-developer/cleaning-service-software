"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  generateAdminPaymentLink,
  recordAdminPaymentLinkCopied,
  sendAdminPaymentRequestNotification,
} from "@/features/admin-booking-wizard/api";
import {
  formatAdminAssistPaymentLinkStatusLabel,
  isAdminAssistPaymentLinkActive,
  type AdminAssistPaymentLinkMetadata,
} from "@/features/bookings/server/admin/adminAssistPaymentLinkMetadata";

type LastNotificationStatus = "queued" | "copied" | "sent" | "failed" | null;

type Props = {
  bookingId: string;
  customerId: string;
  paymentLinksEnabled: boolean;
  customerHasEmail: boolean;
  existingLink: AdminAssistPaymentLinkMetadata | null;
  supersededLinks: AdminAssistPaymentLinkMetadata[];
  generatedByLabel?: string | null;
};

export function AdminBookingDetailPaymentLinkPanel({
  bookingId,
  customerId,
  paymentLinksEnabled,
  customerHasEmail,
  existingLink,
  supersededLinks,
  generatedByLabel,
}: Props) {
  const idempotencyRef = useRef(crypto.randomUUID());
  const copyIdempotencyRef = useRef(crypto.randomUUID());
  const sendEmailIdempotencyRef = useRef(crypto.randomUUID());
  const whatsappIdempotencyRef = useRef(crypto.randomUUID());
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{
    paymentUrl: string;
    reference: string;
    expiresAt: string;
  } | null>(
    existingLink
      ? {
          paymentUrl: existingLink.paymentUrl,
          reference: existingLink.reference,
          expiresAt: existingLink.expiresAt,
        }
      : null,
  );
  const [copied, setCopied] = useState(false);
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [lastNotification, setLastNotification] = useState<{
    status: LastNotificationStatus;
    deliveryChannel: string;
  } | null>(null);

  const activeLink = link ?? existingLink;
  const linkActive = activeLink ? isAdminAssistPaymentLinkActive(activeLink) : false;
  const linkStatus = formatAdminAssistPaymentLinkStatusLabel(activeLink);

  const canSendEmail =
    paymentLinksEnabled &&
    Boolean(activeLink) &&
    linkActive &&
    customerHasEmail;


  const onGenerate = useCallback(
    async (regenerate: boolean) => {
      if (regenerate) {
        idempotencyRef.current = crypto.randomUUID();
      }
      setLoading(true);
      setError(null);
      try {
        const result = await generateAdminPaymentLink(bookingId, {
          customerId,
          idempotencyKey: idempotencyRef.current,
          deliveryChannel: "copy_only",
          regenerate,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setLink({
          paymentUrl: result.paymentLink.paymentUrl,
          reference: result.paymentLink.reference,
          expiresAt: result.paymentLink.expiresAt,
        });
      } catch {
        setError("Could not generate payment link.");
      } finally {
        setLoading(false);
      }
    },
    [bookingId, customerId],
  );

  const onCopy = useCallback(async () => {
    if (!activeLink?.paymentUrl) return;
    try {
      await navigator.clipboard.writeText(activeLink.paymentUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      await recordAdminPaymentLinkCopied(bookingId, {
        customerId,
        idempotencyKey: copyIdempotencyRef.current,
      });
      copyIdempotencyRef.current = crypto.randomUUID();
    } catch {
      setError("Could not copy link to clipboard.");
    }
  }, [activeLink?.paymentUrl, bookingId, customerId]);

  const onSendEmail = useCallback(
    async (resend: boolean) => {
      if (!activeLink || !linkActive) {
        setError("Regenerate the payment link before resending — the current link has expired.");
        return;
      }
      if (resend) {
        sendEmailIdempotencyRef.current = crypto.randomUUID();
      }
      setNotifyLoading(true);
      setError(null);
      try {
        const result = await sendAdminPaymentRequestNotification(bookingId, {
          customerId,
          deliveryChannel: "email",
          idempotencyKey: sendEmailIdempotencyRef.current,
        });
        if (!result.ok) {
          setError(result.message);
          setLastNotification({ status: "failed", deliveryChannel: "email" });
          return;
        }
        setLastNotification({
          status: result.notification.status === "queued" ? "queued" : "queued",
          deliveryChannel: "email",
        });
      } catch {
        setError("Could not send payment request email.");
        setLastNotification({ status: "failed", deliveryChannel: "email" });
      } finally {
        setNotifyLoading(false);
      }
    },
    [activeLink, bookingId, customerId, linkActive],
  );

  const onCopyWhatsApp = useCallback(async () => {
    if (!activeLink || !linkActive) {
      setError("Regenerate the payment link before copying — the current link has expired.");
      return;
    }
    whatsappIdempotencyRef.current = crypto.randomUUID();
    setNotifyLoading(true);
    setError(null);
    try {
      const result = await sendAdminPaymentRequestNotification(bookingId, {
        customerId,
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
      setLastNotification({ status: "copied", deliveryChannel: "whatsapp_copy" });
    } catch {
      setError("Could not copy WhatsApp message.");
    } finally {
      setNotifyLoading(false);
    }
  }, [activeLink, bookingId, customerId, linkActive]);

  if (!paymentLinksEnabled) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950"
      data-testid="admin-booking-payment-link-panel"
    >
      <p className="font-medium">Awaiting payment from customer</p>
      <p className="mt-1 text-xs text-sky-900/90">
        Cleaner assignment begins only after successful payment confirmation.
      </p>

      {generatedByLabel ? (
        <p className="mt-2 text-xs text-sky-800">
          Latest payment request sent by {generatedByLabel}
        </p>
      ) : null}

      {lastNotification ? (
        <p
          className="mt-2 text-xs font-medium text-sky-800"
          data-testid="admin-booking-payment-request-last-status"
        >
          Last request: {lastNotification.status} ({lastNotification.deliveryChannel.replace(/_/g, " ")})
        </p>
      ) : null}

      {activeLink ? (
        <dl className="mt-3 grid gap-1 text-xs">
          <div>
            <dt className="font-medium text-sky-800">Status</dt>
            <dd className="capitalize" data-testid="admin-booking-payment-link-status">
              {linkStatus === "active"
                ? "Active"
                : linkStatus === "expired"
                  ? "Expired"
                  : linkStatus}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-sky-800">Reference</dt>
            <dd className="font-mono">{activeLink.reference}</dd>
          </div>
          <div>
            <dt className="font-medium text-sky-800">Expires</dt>
            <dd data-testid="admin-booking-payment-link-expires">
              This link expires on{" "}
              {new Date(activeLink.expiresAt).toLocaleString("en-ZA", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Africa/Johannesburg",
              })}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-sky-800">Delivery</dt>
            <dd className="capitalize">{activeLink.deliveryChannel.replace(/_/g, " ")}</dd>
          </div>
        </dl>
      ) : null}

      {supersededLinks.length > 0 ? (
        <details className="mt-3 text-xs text-sky-900/90">
          <summary className="cursor-pointer font-medium text-sky-800">
            {supersededLinks.length} superseded link{supersededLinks.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1 font-mono">
            {supersededLinks.map((entry) => (
              <li key={entry.reference} className="text-sky-800/80">
                {entry.reference} · expired {new Date(entry.expiresAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {link || activeLink ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium text-sky-800">Payment link</p>
          <a
            href={(link ?? activeLink)!.paymentUrl}
            className="break-all text-sm font-medium underline-offset-2 hover:underline"
            data-testid="admin-booking-payment-link-url"
          >
            {(link ?? activeLink)!.paymentUrl}
          </a>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onCopy()}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-50"
              data-testid="admin-booking-payment-link-copy"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            {canSendEmail ? (
              <button
                type="button"
                disabled={notifyLoading}
                onClick={() => void onSendEmail(false)}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-50 disabled:opacity-50"
                data-testid="admin-booking-payment-request-send-email"
              >
                {notifyLoading ? "Sending…" : "Send email request"}
              </button>
            ) : null}
            {activeLink ? (
              <button
                type="button"
                disabled={notifyLoading}
                onClick={() => void onCopyWhatsApp()}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-50 disabled:opacity-50"
                data-testid="admin-booking-payment-request-copy-whatsapp"
              >
                {whatsappCopied ? "Copied" : "Copy WhatsApp message"}
              </button>
            ) : null}
            {canSendEmail && lastNotification ? (
              <button
                type="button"
                disabled={notifyLoading}
                onClick={() => void onSendEmail(true)}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-50 disabled:opacity-50"
                data-testid="admin-booking-payment-request-resend"
              >
                Resend request
              </button>
            ) : null}
            <button
              type="button"
              disabled={loading}
              onClick={() => void onGenerate(true)}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-900 hover:bg-sky-50 disabled:opacity-50"
              data-testid="admin-booking-payment-link-regenerate"
            >
              Regenerate link
            </button>
          </div>
          {activeLink && !linkActive ? (
            <p className="text-xs text-amber-800" role="status">
              This link has expired. Regenerate before sending or resending a payment request.
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => void onGenerate(false)}
          className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-sky-900 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
          data-testid="admin-booking-send-payment-request"
        >
          {loading ? "Generating…" : "Send payment request"}
        </button>
      )}

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
