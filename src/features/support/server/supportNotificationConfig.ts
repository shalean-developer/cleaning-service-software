import "server-only";

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

/** When false (default), support notification payloads are not enqueued. */
export function isSupportRequestNotificationsEnabled(): boolean {
  return parseBooleanEnv(process.env.ENABLE_SUPPORT_REQUEST_NOTIFICATIONS);
}

/** When false (default), urgent/internal admin alert payloads are not enqueued. */
export function isSupportAdminAlertsEnabled(): boolean {
  return parseBooleanEnv(process.env.ENABLE_SUPPORT_ADMIN_ALERTS);
}
