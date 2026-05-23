import type { AdminBookingAssistSummary } from "@/features/bookings/server/admin/loadAdminBookingAssistSummary";

type Props = {
  summary: AdminBookingAssistSummary;
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="min-w-[9rem] text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

function notificationStatusLabel(summary: AdminBookingAssistSummary): string {
  if (summary.failedEmailNotification) return "Email delivery failed";
  const sent = summary.adminAssistPaymentTimeline.some(
    (e) => e.kind === "payment_request_sent" && e.deliveryChannel === "email",
  );
  if (sent) return "Email sent or queued";
  const whatsapp = summary.adminAssistPaymentTimeline.some(
    (e) => e.kind === "payment_request_sent" && e.deliveryChannel === "whatsapp_copy",
  );
  if (whatsapp) return "WhatsApp message copied";
  return "No notification sent yet";
}

export function AdminBookingAssistSupportSummary({ summary }: Props) {
  const paymentRef = summary.adminAssistPaymentLink?.reference ?? null;
  const linkStatus = summary.paymentLinkExpired
    ? "Expired"
    : summary.paymentLinkActive
      ? "Active"
      : summary.adminAssistPaymentLink
        ? "Inactive"
        : "None";

  return (
    <section
      className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      data-testid="admin-assist-support-summary"
    >
      <h2 className="text-base font-semibold text-zinc-900">Assist support summary</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Operator-facing contact, payment, and notification details for pilot support.
      </p>
      <dl className="mt-4 space-y-2">
        <Row label="Customer" value={summary.customerLabel} />
        <Row
          label="Contact"
          value={[summary.customerEmail, summary.customerPhone].filter(Boolean).join(" · ") || "No email or phone on file"}
        />
        <Row label="Latest payment link" value={summary.adminAssistPaymentLink?.paymentUrl ?? null} />
        <Row label="Link status" value={linkStatus} />
        <Row label="Payment reference" value={paymentRef} />
        <Row label="Notification status" value={notificationStatusLabel(summary)} />
        <Row label="Offline evidence" value={summary.offlineEvidenceReference} />
        <Row
          label="Last operator action"
          value={
            summary.lastOperatorLabel && summary.lastOperatorActionAt
              ? `${summary.lastOperatorLabel} (${new Date(summary.lastOperatorActionAt).toLocaleString("en-ZA")})`
              : summary.lastOperatorLabel
          }
        />
        {summary.nextRecommendedAction ? (
          <Row
            label="Next action"
            value={`${summary.nextRecommendedAction.label} — ${summary.nextRecommendedAction.reason}`}
          />
        ) : null}
      </dl>
    </section>
  );
}
