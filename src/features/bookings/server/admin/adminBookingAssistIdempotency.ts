import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";

export type AdminBookingDraftIdempotencyResult = {
  bookingId: string;
  status: "draft";
  priceCents: number;
  currency: string;
  idempotent: boolean;
};

export type AdminBookingPendingPaymentIdempotencyResult = {
  bookingId: string;
  status: "pending_payment";
  paymentStatus: "pending";
  priceCents: number;
  currency: string;
  idempotent: boolean;
};

export type AdminBookingPaymentLinkIdempotencyResult = {
  bookingId: string;
  status: "payment_link";
  paymentUrl: string;
  reference: string;
  expiresAt: string;
  priceCents: number;
  currency: string;
  idempotent: boolean;
};

export type AdminBookingPaymentRequestNotificationIdempotencyResult = {
  bookingId: string;
  status: "payment_request_notification";
  deliveryChannel: "email" | "whatsapp_copy";
  notificationStatus: "queued" | "copied";
  paymentUrl: string;
  reference: string;
  copiedText?: string;
  notificationOutboxId?: string;
  idempotent: boolean;
};

export type AdminBookingAssistIdempotencyStoredResult =
  | AdminBookingDraftIdempotencyResult
  | AdminBookingPendingPaymentIdempotencyResult
  | AdminBookingPaymentLinkIdempotencyResult
  | AdminBookingPaymentRequestNotificationIdempotencyResult;

function parseStoredIdempotencyResult(
  raw: unknown,
): AdminBookingAssistIdempotencyStoredResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (typeof row.bookingId !== "string") {
    return null;
  }

  if (
    row.status === "payment_request_notification" &&
    (row.deliveryChannel === "email" || row.deliveryChannel === "whatsapp_copy") &&
    (row.notificationStatus === "queued" || row.notificationStatus === "copied") &&
    typeof row.paymentUrl === "string" &&
    typeof row.reference === "string"
  ) {
    return {
      bookingId: row.bookingId,
      status: "payment_request_notification",
      deliveryChannel: row.deliveryChannel,
      notificationStatus: row.notificationStatus,
      paymentUrl: row.paymentUrl,
      reference: row.reference,
      copiedText: typeof row.copiedText === "string" ? row.copiedText : undefined,
      notificationOutboxId:
        typeof row.notificationOutboxId === "string" ? row.notificationOutboxId : undefined,
      idempotent: true,
    };
  }

  if (typeof row.priceCents !== "number" || typeof row.currency !== "string") {
    return null;
  }

  if (row.status === "draft") {
    return {
      bookingId: row.bookingId,
      status: "draft",
      priceCents: row.priceCents,
      currency: row.currency,
      idempotent: true,
    };
  }

  if (row.status === "pending_payment" && row.paymentStatus === "pending") {
    return {
      bookingId: row.bookingId,
      status: "pending_payment",
      paymentStatus: "pending",
      priceCents: row.priceCents,
      currency: row.currency,
      idempotent: true,
    };
  }

  if (
    row.status === "payment_link" &&
    typeof row.paymentUrl === "string" &&
    typeof row.reference === "string" &&
    typeof row.expiresAt === "string"
  ) {
    return {
      bookingId: row.bookingId,
      status: "payment_link",
      paymentUrl: row.paymentUrl,
      reference: row.reference,
      expiresAt: row.expiresAt,
      priceCents: row.priceCents,
      currency: row.currency,
      idempotent: true,
    };
  }

  return null;
}

export async function findAdminBookingAssistIdempotency(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<AdminBookingDraftIdempotencyResult | null> {
  const stored = await findAdminBookingAssistIdempotencyResult(client, idempotencyKey);
  if (!stored || stored.status !== "draft") {
    return null;
  }
  return stored;
}

export async function findAdminBookingAssistIdempotencyResult(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<AdminBookingAssistIdempotencyStoredResult | null> {
  const { data, error } = await client
    .from("admin_booking_assist_idempotency")
    .select("result")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return parseStoredIdempotencyResult(data?.result);
}

export async function findAdminBookingAssistPendingPaymentIdempotency(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<AdminBookingPendingPaymentIdempotencyResult | null> {
  const stored = await findAdminBookingAssistIdempotencyResult(client, idempotencyKey);
  if (!stored || stored.status !== "pending_payment") {
    return null;
  }
  return stored;
}

export async function findAdminBookingAssistPaymentLinkIdempotency(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<AdminBookingPaymentLinkIdempotencyResult | null> {
  const stored = await findAdminBookingAssistIdempotencyResult(client, idempotencyKey);
  if (!stored || stored.status !== "payment_link") {
    return null;
  }
  return stored;
}

export async function findAdminBookingAssistPaymentRequestNotificationIdempotency(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<AdminBookingPaymentRequestNotificationIdempotencyResult | null> {
  const stored = await findAdminBookingAssistIdempotencyResult(client, idempotencyKey);
  if (!stored || stored.status !== "payment_request_notification") {
    return null;
  }
  return stored;
}

export async function storeAdminBookingAssistIdempotency(
  client: SupabaseClient<Database>,
  input: {
    idempotencyKey: string;
    adminProfileId: string;
    customerId: string;
    result: AdminBookingDraftIdempotencyResult;
  },
): Promise<void> {
  await storeAdminBookingAssistIdempotencyResult(client, {
    idempotencyKey: input.idempotencyKey,
    adminProfileId: input.adminProfileId,
    customerId: input.customerId,
    result: input.result,
  });
}

export async function storeAdminBookingAssistIdempotencyResult(
  client: SupabaseClient<Database>,
  input: {
    idempotencyKey: string;
    adminProfileId: string;
    customerId: string;
    result: AdminBookingAssistIdempotencyStoredResult;
  },
): Promise<void> {
  const { error } = await client.from("admin_booking_assist_idempotency").insert({
    idempotency_key: input.idempotencyKey.trim(),
    admin_profile_id: input.adminProfileId,
    customer_id: input.customerId,
    result: {
      bookingId: input.result.bookingId,
      status: input.result.status,
      priceCents: input.result.priceCents,
      currency: input.result.currency,
      paymentStatus:
        input.result.status === "pending_payment" ? input.result.paymentStatus : undefined,
      paymentUrl:
        input.result.status === "payment_link" ||
        input.result.status === "payment_request_notification"
          ? input.result.paymentUrl
          : undefined,
      reference:
        input.result.status === "payment_link" ||
        input.result.status === "payment_request_notification"
          ? input.result.reference
          : undefined,
      expiresAt: input.result.status === "payment_link" ? input.result.expiresAt : undefined,
      deliveryChannel:
        input.result.status === "payment_request_notification"
          ? input.result.deliveryChannel
          : undefined,
      notificationStatus:
        input.result.status === "payment_request_notification"
          ? input.result.notificationStatus
          : undefined,
      copiedText:
        input.result.status === "payment_request_notification"
          ? input.result.copiedText
          : undefined,
      notificationOutboxId:
        input.result.status === "payment_request_notification"
          ? input.result.notificationOutboxId
          : undefined,
      idempotent: input.result.idempotent,
    } satisfies Json,
  });

  if (error?.code === "23505") {
    return;
  }
  if (error) {
    throw new Error(error.message);
  }
}
