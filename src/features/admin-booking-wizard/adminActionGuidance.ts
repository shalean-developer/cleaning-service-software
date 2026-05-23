import type { AdminBookingFlowSnapshot } from "./adminBookingFlowState";

export function resolveAdminPaymentSummaryLabel(flow: AdminBookingFlowSnapshot): string {
  if (flow.paymentLink?.paymentUrl) {
    return flow.emailRequestSent
      ? "Payment link sent by email"
      : "Payment link generated";
  }
  if (flow.pendingPayment?.bookingId) return "Pending payment";
  if (flow.saved?.bookingId) return "Draft saved — no payment yet";
  return "Not started";
}

export function resolveAdminDisabledActionReason(
  action:
    | "save_draft"
    | "create_unpaid"
    | "generate_payment_link"
    | "send_email"
    | "offline_payment"
    | "finalize_paid",
  opts: {
    featureEnabled: boolean;
    paymentLinksEnabled: boolean;
    offlinePaymentsEnabled: boolean;
    formReady: boolean;
    hasDraft: boolean;
    hasPendingPayment: boolean;
    hasPaymentLink: boolean;
    hasCustomerEmail: boolean;
  },
): string | null {
  switch (action) {
    case "save_draft":
      if (!opts.featureEnabled) return "Enable admin-assisted booking to save drafts.";
      if (opts.hasDraft) return "Draft already saved for this session.";
      if (!opts.formReady) return "Save draft requires customer, service, schedule, and address.";
      return null;
    case "create_unpaid":
      if (!opts.featureEnabled) return "Enable admin-assisted booking first.";
      if (!opts.hasDraft) return "Create unpaid booking requires a saved draft.";
      if (opts.hasPendingPayment) return "Booking is already pending payment.";
      return null;
    case "generate_payment_link":
      if (!opts.paymentLinksEnabled) return "Payment links are disabled for this environment.";
      if (!opts.hasPendingPayment) return "Generate payment link requires a pending payment booking.";
      if (opts.hasPaymentLink) return "Payment link already generated.";
      return null;
    case "send_email":
      if (!opts.hasCustomerEmail) return "Customer email is required to send a payment request.";
      if (!opts.hasPendingPayment) return "Send email requires a pending payment booking.";
      return null;
    case "offline_payment":
      if (!opts.offlinePaymentsEnabled) return "Offline payments are disabled for this environment.";
      if (!opts.hasPendingPayment) return "Offline payment is available only after pending payment is created.";
      return null;
    case "finalize_paid":
      return "Finalize paid booking is not available from the admin wizard.";
  }
}
