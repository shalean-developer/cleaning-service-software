import "server-only";

import { isDeployedRuntime, resolveNotificationAppBaseUrl } from "@/lib/app/appBaseUrl";

export type NotificationEmailProvider = "dry_run" | "resend";

export const PAYMENT_CONFIRMED_TEMPLATE = "payment_confirmed" as const;
export const PAYMENT_FAILED_TEMPLATE = "payment_failed" as const;
export const ASSIGNMENT_OFFER_TEMPLATE = "assignment_offer" as const;

/** Templates the worker may poll and deliver (template + channel must match enqueue). */
export const DELIVERABLE_NOTIFICATION_SPECS = [
  { template: PAYMENT_CONFIRMED_TEMPLATE, channel: "email" as const },
  { template: PAYMENT_FAILED_TEMPLATE, channel: "email" as const },
  { template: ASSIGNMENT_OFFER_TEMPLATE, channel: "push" as const },
] as const;

/**
 * PostgREST `.or()` filter: supported template/channel pairs only.
 * Used when polling `notification_outbox` so unsupported pending rows do not block the queue.
 */
export function buildDeliverableOutboxTemplateOrFilter(): string {
  return [
    `and(channel.eq.email,payload->>template.in.(${PAYMENT_CONFIRMED_TEMPLATE},${PAYMENT_FAILED_TEMPLATE}))`,
    `and(channel.eq.push,payload->>template.eq.${ASSIGNMENT_OFFER_TEMPLATE})`,
  ].join(",");
}

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
  emailProvider: NotificationEmailProvider;
  providerReady: boolean;
  fromEmail: string | null;
  supportEmail: string | null;
  appBaseUrl: string;
};

function isResendConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.NOTIFICATION_FROM_EMAIL?.trim(),
  );
}

/**
 * Resolves email transport for the notification worker.
 * Defaults to dry_run when Resend is not configured; production defaults to resend when configured.
 */
export function resolveNotificationEmailProvider(): NotificationEmailProvider {
  const explicit = process.env.NOTIFICATION_EMAIL_PROVIDER?.trim().toLowerCase();
  if (explicit === "dry_run" || explicit === "resend") {
    return explicit;
  }

  if (!isResendConfigured()) {
    return "dry_run";
  }

  if (isDeployedRuntime() && process.env.VERCEL_ENV === "production") {
    return "resend";
  }

  return "dry_run";
}

export function isNotificationDryRunProvider(): boolean {
  return resolveNotificationEmailProvider() === "dry_run";
}

/** When false, dry_run logs preview on the row and leaves it pending (last_error metadata). */
export function shouldMarkDryRunSent(): boolean {
  const raw = process.env.NOTIFICATION_DRY_RUN_MARK_SENT?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  return true;
}

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
  const emailProvider = resolveNotificationEmailProvider();
  const providerReady =
    emailProvider === "dry_run" || Boolean(fromEmail && resendKey);

  return {
    enabled: isNotificationDeliveryEnabled(),
    emailProvider,
    providerReady,
    fromEmail,
    supportEmail: process.env.NOTIFICATION_SUPPORT_EMAIL?.trim() || null,
    appBaseUrl: resolveNotificationAppBaseUrl(),
  };
}

/** Delivery may run only when flag is on and the selected provider is ready. */
export function canRunNotificationDelivery(): boolean {
  const config = getNotificationDeliveryConfig();
  if (!config.enabled) return false;
  if (config.emailProvider === "dry_run") return true;
  return config.providerReady;
}
