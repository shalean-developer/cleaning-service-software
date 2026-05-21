import "server-only";

export const RECURRING_PAYMENT_REQUIRED_CHILD_TEMPLATE =
  "recurring_payment_required_child" as const;
export const RECURRING_PAYMENT_REMINDER_TEMPLATE = "recurring_payment_reminder" as const;
export const RECURRING_OVERDUE_ADMIN_ALERT_TEMPLATE = "recurring_overdue_admin_alert" as const;
export const RECURRING_CUSTOMER_REQUEST_SUBMITTED_TEMPLATE =
  "recurring_customer_request_submitted" as const;
export const RECURRING_ADMIN_REQUEST_RESOLVED_TEMPLATE =
  "recurring_admin_request_resolved" as const;

export const RECURRING_NOTIFICATION_TEMPLATES = [
  RECURRING_PAYMENT_REQUIRED_CHILD_TEMPLATE,
  RECURRING_PAYMENT_REMINDER_TEMPLATE,
  RECURRING_OVERDUE_ADMIN_ALERT_TEMPLATE,
  RECURRING_CUSTOMER_REQUEST_SUBMITTED_TEMPLATE,
  RECURRING_ADMIN_REQUEST_RESOLVED_TEMPLATE,
] as const;

export type RecurringNotificationTemplate =
  (typeof RECURRING_NOTIFICATION_TEMPLATES)[number];

/** When false (default), recurring notification payloads are not enqueued or sent. */
export function isRecurringNotificationsEnabled(): boolean {
  const raw = process.env.ENABLE_RECURRING_NOTIFICATIONS?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}
