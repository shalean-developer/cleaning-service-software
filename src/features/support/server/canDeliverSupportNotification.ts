import "server-only";

import { getNotificationDeliveryConfig } from "@/features/notifications/server/config";
import {
  isSupportAdminAlertsEnabled,
  isSupportRequestNotificationsEnabled,
} from "./supportNotificationConfig";
import { isAdminUrgentSupportPayload, type ParsedSupportOutboxPayload } from "./parseSupportOutboxPayload";

export type SupportDeliverySkipReason =
  | "customer_notifications_disabled"
  | "admin_alerts_disabled"
  | "admin_support_email_missing";

export function canDeliverSupportNotification(
  payload: ParsedSupportOutboxPayload,
): { ok: true } | { ok: false; reason: SupportDeliverySkipReason } {
  if (isAdminUrgentSupportPayload(payload)) {
    if (!isSupportAdminAlertsEnabled()) {
      return { ok: false, reason: "admin_alerts_disabled" };
    }
    if (!getNotificationDeliveryConfig().supportEmail) {
      return { ok: false, reason: "admin_support_email_missing" };
    }
    return { ok: true };
  }

  if (!isSupportRequestNotificationsEnabled()) {
    return { ok: false, reason: "customer_notifications_disabled" };
  }

  return { ok: true };
}
