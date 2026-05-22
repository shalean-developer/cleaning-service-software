import { isSupportRequestNotificationsEnabled } from "@/features/support/server/supportNotificationConfig";

/** @deprecated Use isSupportRequestNotificationsEnabled() — defaults off via env. */
export const BOOKING_SUPPORT_NOTIFICATIONS_ENABLED = isSupportRequestNotificationsEnabled();
