import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { requirePaystackEnv } from "./paystackEnv";
import type {
  PaystackInitializeRequest,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
} from "./paystackTypes";

export class PaystackApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "PaystackApiError";
  }
}

async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { secretKey, baseUrl } = requirePaystackEnv();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "message" in body && body.message
        ? String(body.message)
        : `Paystack API error (${response.status})`;
    throw new PaystackApiError(response.status, message);
  }

  return body;
}

export async function paystackInitializeTransaction(
  payload: PaystackInitializeRequest,
): Promise<PaystackInitializeResponse> {
  const result = await paystackFetch<PaystackInitializeResponse>(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  if (!result.status || !result.data?.authorization_url) {
    throw new PaystackApiError(502, result.message || "Paystack initialize failed.");
  }

  return result;
}

export async function paystackVerifyTransaction(
  reference: string,
): Promise<PaystackVerifyResponse> {
  const encoded = encodeURIComponent(reference);
  const result = await paystackFetch<PaystackVerifyResponse>(
    `/transaction/verify/${encoded}`,
    { method: "GET" },
  );

  if (!result.status || !result.data?.reference) {
    throw new PaystackApiError(502, result.message || "Paystack verify failed.");
  }

  return result;
}

/**
 * Validates Paystack `x-paystack-signature` (HMAC SHA512 of raw body).
 */
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader?.trim()) return false;

  const { webhookSecret } = requirePaystackEnv();
  const digest = createHmac("sha512", webhookSecret).update(rawBody).digest("hex");

  const expected = Buffer.from(digest, "utf8");
  const received = Buffer.from(signatureHeader.trim(), "utf8");

  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
