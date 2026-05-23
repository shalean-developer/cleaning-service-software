import type { AdminBookingFlowServerStatus } from "./adminBookingFlowSync";

export type AdminBookingFlowProgress = {
  draftSaved: boolean;
  pendingPaymentCreated: boolean;
  paymentLinkGenerated: boolean;
  emailRequestSent: boolean;
  whatsappCopied: boolean;
  offlinePaymentRecorded: boolean;
  bookingConfirmed: boolean;
};

export type AdminBookingFlowSnapshot = {
  saved: {
    bookingId: string;
    customerId: string;
    priceCents: number;
  } | null;
  pendingPayment: { bookingId: string } | null;
  paymentLink: {
    paymentUrl: string;
    reference: string;
    expiresAt: string;
  } | null;
  emailRequestSent: boolean;
  whatsappCopied: boolean;
  serverStatus: AdminBookingFlowServerStatus | null;
};

export const EMPTY_ADMIN_BOOKING_FLOW: AdminBookingFlowSnapshot = {
  saved: null,
  pendingPayment: null,
  paymentLink: null,
  emailRequestSent: false,
  whatsappCopied: false,
  serverStatus: null,
};

export function deriveAdminBookingFlowProgress(
  flow: AdminBookingFlowSnapshot,
): AdminBookingFlowProgress {
  const server = flow.serverStatus;
  return {
    draftSaved: Boolean(flow.saved?.bookingId) || server?.status === "draft",
    pendingPaymentCreated:
      Boolean(flow.pendingPayment?.bookingId) || server?.status === "pending_payment",
    paymentLinkGenerated: Boolean(flow.paymentLink?.paymentUrl),
    emailRequestSent: flow.emailRequestSent || Boolean(server?.emailRequestSent),
    whatsappCopied: flow.whatsappCopied || Boolean(server?.whatsappMessageSent),
    offlinePaymentRecorded: Boolean(server?.offlinePaymentRecorded),
    bookingConfirmed: Boolean(server?.bookingConfirmed),
  };
}

export type AdminBookingFlowPhase =
  | "draft"
  | "pending_payment"
  | "payment_link_generated"
  | "awaiting_customer_payment"
  | "confirmed";

export function resolveAdminBookingFlowPhase(
  flow: AdminBookingFlowSnapshot,
): AdminBookingFlowPhase {
  if (flow.serverStatus?.bookingConfirmed) return "confirmed";
  if (flow.paymentLink?.paymentUrl) return "payment_link_generated";
  if (flow.pendingPayment?.bookingId || flow.serverStatus?.status === "pending_payment") {
    return "pending_payment";
  }
  if (flow.saved?.bookingId || flow.serverStatus?.status === "draft") return "draft";
  return "draft";
}

export function resolveAdminBookingFlowPhaseLabel(phase: AdminBookingFlowPhase): string {
  switch (phase) {
    case "draft":
      return "Draft (not yet pending payment)";
    case "pending_payment":
      return "Pending payment";
    case "payment_link_generated":
      return "Payment link generated";
    case "awaiting_customer_payment":
      return "Awaiting customer payment";
    case "confirmed":
      return "Confirmed";
  }
}
