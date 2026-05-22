/** Repository-relative ops doc paths (reference links for admin UI). */
export const ADMIN_RUNBOOKS = {
  assignmentRecovery: {
    title: "Assignment recovery after payment",
    docPath: "docs/operations/assignment-recovery.md",
    summary: "Paid bookings stuck on confirmed without dispatch. cron and ops script.",
  },
  assignmentDeclineRedispatch: {
    title: "Assignment decline & redispatch",
    docPath: "docs/operations/assignment-decline-redispatch.md",
    summary: "How auto-redispatch works for best_available vs selected cleaner paths.",
  },
  paymentFailedRetry: {
    title: "Payment failed. customer retry",
    docPath: "docs/operations/payment-failed-customer-retry.md",
    summary: "Customer-facing retry; admin cannot finalize payment in the dashboard.",
  },
  expirePendingPayments: {
    title: "Expire pending payments cron",
    docPath: "docs/operations/expire-pending-payments-cron.md",
    summary: "Checkout sessions that never completed within the pending window.",
  },
  expireAssignmentOffers: {
    title: "Expire assignment offers cron",
    docPath: "docs/operations/expire-assignment-offers-cron.md",
    summary: "Stale offers and best_available auto-redispatch after expiry.",
  },
  adminDashboard: {
    title: "Admin operational dashboard",
    docPath: "docs/operations/admin-operational-dashboard.md",
    summary: "Queue badges, filters, and what admin can vs cannot do in-app.",
  },
} as const;

export type AdminRunbookKey = keyof typeof ADMIN_RUNBOOKS;
