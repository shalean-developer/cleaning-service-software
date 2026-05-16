import "server-only";

import {
  buildPaymentSuccessCallbackUrl,
  normalizeAppBaseUrl,
} from "./paymentReturn";

/**
 * Server-only app origin for absolute URLs (Paystack callback, emails).
 * Prefer APP_BASE_URL, then NEXT_PUBLIC_APP_URL, then VERCEL_URL.
 */
export function getServerAppBaseUrl(): string | null {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return normalizeAppBaseUrl(explicit);

  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (publicUrl) return normalizeAppBaseUrl(publicUrl);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return normalizeAppBaseUrl(`https://${vercel}`);

  return null;
}

export function getServerPaystackPaymentSuccessCallbackUrl(): string | null {
  const base = getServerAppBaseUrl();
  if (!base) return null;
  return buildPaymentSuccessCallbackUrl(base);
}
