import "server-only";

export const PAYMENT_CONFIRMED_TEMPLATE = "payment_confirmed" as const;
export const PAYMENT_FAILED_TEMPLATE = "payment_failed" as const;

export const NOTIFICATION_OUTBOX_BATCH_SIZE = 25;
export const NOTIFICATION_MAX_ATTEMPTS = 5;
export const NOTIFICATION_RETRY_BASE_MINUTES = 15;
/** Reclaim `processing` → `pending` when `updated_at` is older than this (minutes). */
export const NOTIFICATION_PROCESSING_STALE_MINUTES = 15;

export function getProcessingStaleMinutes(): number {
  const raw = process.env.NOTIFICATION_PROCESSING_STALE_MINUTES?.trim();
  if (!raw) return NOTIFICATION_PROCESSING_STALE_MINUTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return NOTIFICATION_PROCESSING_STALE_MINUTES;
  }
  return parsed;
}

export type NotificationDeliveryConfig = {
  enabled: boolean;
  providerReady: boolean;
  fromEmail: string | null;
  supportEmail: string | null;
  appBaseUrl: string;
};

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function isNotificationDeliveryEnabled(): boolean {
  return parseBooleanEnv(process.env.ENABLE_NOTIFICATION_DELIVERY);
}

export function getNotificationDeliveryConfig(): NotificationDeliveryConfig {
  const fromEmail = process.env.NOTIFICATION_FROM_EMAIL?.trim() || null;
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const postmarkToken = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const providerReady = Boolean(fromEmail && (resendKey || postmarkToken));

  const appBaseUrl =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  return {
    enabled: isNotificationDeliveryEnabled(),
    providerReady,
    fromEmail,
    supportEmail: process.env.NOTIFICATION_SUPPORT_EMAIL?.trim() || null,
    appBaseUrl: appBaseUrl.replace(/\/$/, ""),
  };
}

/** Delivery may run only when flag is on and provider env is complete. */
export function canRunNotificationDelivery(): boolean {
  const config = getNotificationDeliveryConfig();
  return config.enabled && config.providerReady;
}
