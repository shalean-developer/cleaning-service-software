import "server-only";

import { verifyPaystackWebhookSignature } from "./paystackClient";
import type { PaystackWebhookEvent } from "./paystackTypes";
import {
  routePaystackWebhookEvent,
  type WebhookHandlerResult,
} from "./routePaystackWebhookEvent";

export type { WebhookHandlerResult };

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

  return routePaystackWebhookEvent(event);
}
