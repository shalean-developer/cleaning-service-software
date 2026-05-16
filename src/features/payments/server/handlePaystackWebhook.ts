import "server-only";

import { verifyPaystackWebhookSignature } from "./paystackClient";
import { mapPaystackWebhookChargeSuccess } from "./mapPaystackCharge";
import type { PaystackWebhookEvent } from "./paystackTypes";
import { processPaystackChargeSuccess } from "./upsertBookingFromPaystack";

export type WebhookHandlerResult =
  | { ok: true; handled: true; idempotent: boolean; bookingId: string; status: string }
  | { ok: true; handled: false; reason: string }
  | { ok: false; code: string; message: string; status: number };

export async function handlePaystackWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<WebhookHandlerResult> {
  if (!verifyPaystackWebhookSignature(rawBody, signatureHeader)) {
    return {
      ok: false,
      code: "INVALID_SIGNATURE",
      message: "Paystack webhook signature verification failed.",
      status: 401,
    };
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Webhook body is not valid JSON.",
      status: 400,
    };
  }

  if (event.event !== "charge.success") {
    return { ok: true, handled: false, reason: `ignored:${event.event}` };
  }

  const charge = mapPaystackWebhookChargeSuccess(event);
  if (!charge) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "charge.success payload could not be mapped.",
      status: 400,
    };
  }

  const result = await processPaystackChargeSuccess(charge, "webhook");
  if (!result.ok) {
    const status =
      result.code === "AMOUNT_MISMATCH"
        ? 409
        : result.code === "PAYMENT_NOT_FOUND"
          ? 404
          : 400;
    return {
      ok: false,
      code: result.code,
      message: result.message,
      status,
    };
  }

  return {
    ok: true,
    handled: true,
    idempotent: result.idempotent,
    bookingId: result.bookingId,
    status: result.status,
  };
}
