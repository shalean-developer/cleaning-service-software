import "server-only";

import {
  buildPaymentSuccessCallbackUrl,
  normalizeAppBaseUrl,
} from "./paymentReturn";

/** True when the host is local-only (unsuitable for production email links). */
export function isLocalhostAppBaseUrl(base: string): boolean {
  try {
    const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
    const host = new URL(withScheme).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(base);
  }
}

/** Vercel preview/production or NODE_ENV=production (hosted runtimes). */
export function isDeployedRuntime(): boolean {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv === "production" || vercelEnv === "preview") return true;
  return process.env.NODE_ENV === "production";
}

function collectAppBaseUrlCandidates(): string[] {
  const candidates: string[] = [];
  const push = (raw: string | undefined) => {
    const trimmed = raw?.trim();
    if (trimmed) candidates.push(normalizeAppBaseUrl(trimmed));
  };

  push(process.env.APP_BASE_URL);
  push(process.env.NEXT_PUBLIC_APP_URL);

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const normalized = normalizeAppBaseUrl(vercel.startsWith("http") ? vercel : `https://${vercel}`);
    if (!candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  }

  return candidates;
}

/**
 * Server-only app origin for absolute URLs (Paystack callback, emails).
 * Prefer APP_BASE_URL, then NEXT_PUBLIC_APP_URL, then VERCEL_URL.
 */
export function getServerAppBaseUrl(): string | null {
  const candidates = collectAppBaseUrlCandidates();
  return candidates[0] ?? null;
}

/**
 * App origin for notification email links.
 * On deployed runtimes, never returns localhost when a public origin is available.
 */
export function resolveNotificationAppBaseUrl(): string {
  const deployed = isDeployedRuntime();
  const candidates = collectAppBaseUrlCandidates();

  for (const url of candidates) {
    if (deployed && isLocalhostAppBaseUrl(url)) continue;
    return url;
  }

  if (!deployed) {
    return "http://localhost:3000";
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return normalizeAppBaseUrl(vercel.startsWith("http") ? vercel : `https://${vercel}`);
  }

  return candidates.find((url) => !isLocalhostAppBaseUrl(url)) ?? "http://localhost:3000";
}

export function buildCleanerOffersPageUrl(appBaseUrl: string): string {
  return `${normalizeAppBaseUrl(appBaseUrl)}/cleaner/offers`;
}

export function getServerPaystackPaymentSuccessCallbackUrl(): string | null {
  const base = getServerAppBaseUrl();
  if (!base) return null;
  return buildPaymentSuccessCallbackUrl(base);
}
