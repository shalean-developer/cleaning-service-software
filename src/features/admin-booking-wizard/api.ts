import {
  type AdminBookingWizardFlowBookingDetail,
} from "./adminBookingFlowSync";

export async function fetchAdminBookingWizardFlowDetail(
  bookingId: string,
): Promise<
  | { ok: true; booking: AdminBookingWizardFlowBookingDetail }
  | { ok: false; message: string }
> {
  const trimmed = bookingId.trim();
  if (!trimmed) {
    return { ok: false, message: "Booking ID is required." };
  }

  const response = await fetch(`/api/admin/bookings/${encodeURIComponent(trimmed)}`);
  const json = (await response.json()) as
    | { ok: true; booking: AdminBookingWizardFlowBookingDetail }
    | { ok: false; message?: string };

  if (!response.ok || !json.ok || !("booking" in json)) {
    return {
      ok: false,
      message: "message" in json && json.message ? json.message : "Could not refresh booking state.",
    };
  }

  return { ok: true, booking: json.booking };
}

export type SaveAdminBookingDraftResponse =
  | {
      ok: true;
      bookingDraft: {
        bookingId: string;
        status: "draft";
        priceCents: number;
        currency: string;
        idempotent: boolean;
      };
      customerId?: string;
    }
  | { ok: false; error: string; message: string };

export type CreateAdminPendingPaymentResponse =
  | {
      ok: true;
      booking: {
        bookingId: string;
        status: "pending_payment";
        paymentStatus: "pending";
        priceCents: number;
        currency: string;
        idempotent: boolean;
      };
    }
  | { ok: false; error: string; message: string };

export type GenerateAdminPaymentLinkResponse =
  | {
      ok: true;
      paymentLink: {
        bookingId: string;
        paymentUrl: string;
        reference: string;
        expiresAt: string;
        idempotent: boolean;
      };
    }
  | { ok: false; error: string; message: string };

export async function recordAdminPaymentLinkCopied(
  bookingId: string,
  body: { customerId: string; idempotencyKey: string },
): Promise<{ ok: true; recorded: true } | { ok: false; error: string; message: string }> {
  const response = await fetch(`/api/admin/bookings/${bookingId}/payment-link/copy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as
    | { ok: true; recorded: true }
    | { ok: false; error: string; message: string };
}

export type SendAdminPaymentRequestNotificationResponse =
  | {
      ok: true;
      notification: {
        bookingId: string;
        deliveryChannel: "email" | "whatsapp_copy";
        status: "queued" | "copied";
        paymentUrl: string;
        copiedText?: string;
      };
    }
  | { ok: false; error: string; message: string };

export async function sendAdminPaymentRequestNotification(
  bookingId: string,
  body: {
    customerId: string;
    deliveryChannel: "email" | "whatsapp_copy";
    idempotencyKey: string;
    message?: string;
    reason?: string;
  },
): Promise<SendAdminPaymentRequestNotificationResponse> {
  const response = await fetch(
    `/api/admin/bookings/${bookingId}/payment-request/send`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return (await response.json()) as SendAdminPaymentRequestNotificationResponse;
}

export type RecordAdminOfflinePaymentResponse =
  | {
      ok: true;
      payment: {
        bookingId: string;
        status: "confirmed";
        paymentStatus: "paid";
        rail: "eft" | "cash" | "card_machine";
        reference: string;
      };
    }
  | { ok: false; error: string; message: string };

export async function recordAdminOfflinePayment(
  bookingId: string,
  body: {
    customerId: string;
    amountCents: number;
    rail: "eft" | "cash" | "card_machine";
    receivedAt: string;
    evidenceReference: string;
    reason: string;
    idempotencyKey: string;
    bankReference?: string;
    terminalReference?: string;
    receiptNumber?: string;
    notes?: string;
    confirmSupersedesActivePaymentLink?: boolean;
  },
): Promise<RecordAdminOfflinePaymentResponse> {
  const response = await fetch(`/api/admin/bookings/${bookingId}/offline-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as RecordAdminOfflinePaymentResponse;
}

export async function generateAdminPaymentLink(
  bookingId: string,
  body: {
    customerId: string;
    idempotencyKey: string;
    deliveryChannel?: "email" | "sms" | "whatsapp" | "copy_only";
    reason?: string;
    regenerate?: boolean;
  },
): Promise<GenerateAdminPaymentLinkResponse> {
  const response = await fetch(`/api/admin/bookings/${bookingId}/payment-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as GenerateAdminPaymentLinkResponse;
  return json;
}

export async function createAdminPendingPaymentBooking(
  bookingId: string,
  body: { customerId: string; idempotencyKey: string; reason?: string },
): Promise<CreateAdminPendingPaymentResponse> {
  const response = await fetch(`/api/admin/bookings/${bookingId}/pending-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as CreateAdminPendingPaymentResponse;
  return json;
}

export async function saveAdminBookingDraft(
  body: Record<string, unknown>,
): Promise<SaveAdminBookingDraftResponse> {
  const response = await fetch("/api/admin/bookings/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as SaveAdminBookingDraftResponse;
  return json;
}
