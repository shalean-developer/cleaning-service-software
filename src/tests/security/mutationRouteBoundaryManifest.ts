/**
 * Stage 5B-2b: approved HTTP mutation route boundaries.
 * Paths are relative to `src/app/api/`.
 *
 * @see docs/architecture/stage-5b-2b-mutation-route-command-boundary-design.md
 */

export type MutationRouteCategory =
  | "customer"
  | "cleaner"
  | "admin"
  | "cron"
  | "paystack"
  | "read_only_post";

export type MutationRouteRule = {
  /** e.g. `bookings/lock/route.ts` */
  routeFile: string;
  category: MutationRouteCategory;
  /** At least one symbol must appear in an import statement in the route file */
  requiredFacadeImports: string[];
  /** Optional additional imports (e.g. cron auth). all must be present */
  requiredAdditionalImports?: string[];
  /** When true, route may import `@/lib/supabase/serviceRole` */
  mayImportServiceRole?: boolean;
};

/** Lifecycle-mutating POST routes (29). */
export const MUTATION_ROUTE_RULES: MutationRouteRule[] = [
  {
    routeFile: "bookings/lock/route.ts",
    category: "customer",
    requiredFacadeImports: ["createBookingPaymentLock"],
  },
  {
    routeFile: "bookings/[bookingId]/payment-retry-lock/route.ts",
    category: "customer",
    requiredFacadeImports: ["createPaymentRetryLock"],
  },
  {
    routeFile: "paystack/initialize/route.ts",
    category: "paystack",
    requiredFacadeImports: ["initializePayment"],
  },
  {
    routeFile: "paystack/initialize-zoho-invoice/route.ts",
    category: "paystack",
    requiredFacadeImports: ["initializeZohoInvoicePayment"],
  },
  {
    routeFile: "paystack/verify/route.ts",
    category: "paystack",
    requiredFacadeImports: ["verifyPayment"],
  },
  {
    routeFile: "paystack/webhook/route.ts",
    category: "paystack",
    requiredFacadeImports: ["handlePaystackWebhook"],
  },
  {
    routeFile: "cleaner/offers/[offerId]/accept/route.ts",
    category: "cleaner",
    requiredFacadeImports: ["acceptCleanerOffer", "createBookingCommandBackend"],
  },
  {
    routeFile: "cleaner/offers/[offerId]/decline/route.ts",
    category: "cleaner",
    requiredFacadeImports: [
      "declineCleanerOffer",
      "handleOfferDeclinedFollowUp",
      "createBookingCommandBackend",
    ],
  },
  {
    routeFile: "cleaner/jobs/[bookingId]/start/route.ts",
    category: "cleaner",
    requiredFacadeImports: ["startCleanerJob"],
  },
  {
    routeFile: "cleaner/jobs/[bookingId]/complete/route.ts",
    category: "cleaner",
    requiredFacadeImports: ["completeCleanerJob"],
  },
  {
    routeFile: "admin/zoho-invoice-payments/charge-saved-card/route.ts",
    category: "admin",
    requiredFacadeImports: ["adminChargeZohoInvoiceSavedMethod"],
  },
  {
    routeFile: "admin/zoho-invoice-payments/audit-export/route.ts",
    category: "admin",
    requiredFacadeImports: ["exportZohoInvoicePaymentAudit"],
  },
  {
    routeFile: "admin/zoho-invoice-payments/payment-methods/[paymentMethodId]/revoke/route.ts",
    category: "admin",
    requiredFacadeImports: ["revokeAdminPaymentMethod"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/payout-ready/route.ts",
    category: "admin",
    requiredFacadeImports: ["markBookingPayoutReadyAdmin"],
  },
  {
    routeFile: "admin/bookings/draft/route.ts",
    category: "admin",
    requiredFacadeImports: ["adminCreateBookingDraftFacade"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/mark-paid-out/route.ts",
    category: "admin",
    requiredFacadeImports: ["markBookingPaidOutAdmin"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/dispatch-offer/route.ts",
    category: "admin",
    requiredFacadeImports: ["runAdminManualDispatchOffer"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/replace-open-offer/route.ts",
    category: "admin",
    requiredFacadeImports: ["runAdminReplaceOpenOffer"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/recover-assignment/route.ts",
    category: "admin",
    requiredFacadeImports: ["runAdminSingleBookingAssignmentRecovery"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/dispatch-deferred-assignment/route.ts",
    category: "admin",
    requiredFacadeImports: ["runAdminDeferredDispatchNow"],
  },
  {
    routeFile: "admin/cleaners/[cleanerId]/deactivate/route.ts",
    category: "admin",
    requiredFacadeImports: ["deactivateCleaner"],
  },
  {
    routeFile: "admin/cleaners/[cleanerId]/suspend/route.ts",
    category: "admin",
    requiredFacadeImports: ["suspendCleaner"],
  },
  {
    routeFile: "admin/cleaners/[cleanerId]/reactivate/route.ts",
    category: "admin",
    requiredFacadeImports: ["reactivateCleaner"],
  },
  {
    routeFile: "admin/cleaners/[cleanerId]/unsuspend/route.ts",
    category: "admin",
    requiredFacadeImports: ["unsuspendCleaner"],
  },
  {
    routeFile: "admin/cleaners/[cleanerId]/archive/route.ts",
    category: "admin",
    requiredFacadeImports: ["archiveCleanerAdminCommand"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/archive/route.ts",
    category: "admin",
    requiredFacadeImports: ["archiveBookingAdminCommand"],
  },
  {
    routeFile: "admin/bookings/[bookingId]/hard-delete/route.ts",
    category: "admin",
    requiredFacadeImports: ["hardDeleteBookingAdminCommand"],
  },
  {
    routeFile: "admin/customers/[customerId]/archive/route.ts",
    category: "admin",
    requiredFacadeImports: ["archiveCustomerAdminCommand"],
  },
  {
    routeFile: "cron/expire-pending-payments/route.ts",
    category: "cron",
    requiredFacadeImports: ["expireStalePendingPayments"],
    requiredAdditionalImports: ["verifyCronSecret", "createBookingCommandBackend"],
    mayImportServiceRole: true,
  },
  {
    routeFile: "cron/expire-assignment-offers/route.ts",
    category: "cron",
    requiredFacadeImports: ["expireStaleAssignmentOffers"],
    requiredAdditionalImports: ["verifyCronSecret", "createBookingCommandBackend"],
    mayImportServiceRole: true,
  },
  {
    routeFile: "cron/recover-assignment-after-payment/route.ts",
    category: "cron",
    requiredFacadeImports: ["runAssignmentRecoveryBatch"],
    requiredAdditionalImports: ["verifyCronSecret", "createBookingCommandBackend"],
    mayImportServiceRole: true,
  },
  {
    routeFile: "cron/dispatch-deferred-assignments/route.ts",
    category: "cron",
    requiredFacadeImports: ["runDeferredAssignmentDispatchBatch"],
    requiredAdditionalImports: ["verifyCronSecret", "createBookingCommandBackend"],
    mayImportServiceRole: true,
  },
  {
    routeFile: "cron/reconcile-zoho-invoice-payments/route.ts",
    category: "cron",
    requiredFacadeImports: ["retryZohoInvoiceReconciliation"],
    requiredAdditionalImports: ["verifyCronSecret"],
    mayImportServiceRole: true,
  },
];

/** POST routes that do not mutate booking/payment/assignment/earning lifecycle (3). */
export const READ_ONLY_POST_ROUTE_RULES: MutationRouteRule[] = [
  {
    routeFile: "pricing/quote/route.ts",
    category: "read_only_post",
    requiredFacadeImports: ["calculateQuote"],
  },
  {
    routeFile: "cleaners/available/route.ts",
    category: "read_only_post",
    requiredFacadeImports: ["getAvailableCleaners"],
  },
  {
    routeFile: "booking/cleaners/route.ts",
    category: "read_only_post",
    requiredFacadeImports: ["getBookingCleaners"],
  },
];

/** Matches 5B-2a `customerMutationRoutes.test.ts` (bookings + paystack initialize/verify). */
export const CUSTOMER_POST_ALLOWLIST = [
  "bookings/lock/route.ts",
  "bookings/[bookingId]/payment-retry-lock/route.ts",
  "paystack/initialize/route.ts",
  "paystack/initialize-zoho-invoice/route.ts",
  "paystack/verify/route.ts",
] as const;

/** Matches 5B-2a `cleanerMutationRoutes.test.ts`. */
export const CLEANER_POST_ALLOWLIST = [
  "offers/[offerId]/accept/route.ts",
  "offers/[offerId]/decline/route.ts",
  "jobs/[bookingId]/start/route.ts",
  "jobs/[bookingId]/complete/route.ts",
] as const;

/** Matches 5B-2a `adminApiRoutes.test.ts` (paths relative to `admin/`). */
export const ADMIN_POST_ALLOWLIST = [
  "bookings/draft/route.ts",
  "zoho-invoice-payments/audit-export/route.ts",
  "zoho-invoice-payments/charge-saved-card/route.ts",
  "zoho-invoice-payments/payment-methods/[paymentMethodId]/revoke/route.ts",
  "bookings/[bookingId]/payout-ready/route.ts",
  "bookings/[bookingId]/mark-paid-out/route.ts",
  "bookings/[bookingId]/recover-assignment/route.ts",
  "bookings/[bookingId]/dispatch-deferred-assignment/route.ts",
  "bookings/[bookingId]/dispatch-offer/route.ts",
  "bookings/[bookingId]/replace-open-offer/route.ts",
  "bookings/[bookingId]/archive/route.ts",
  "bookings/[bookingId]/hard-delete/route.ts",
  "cleaners/[cleanerId]/deactivate/route.ts",
  "cleaners/[cleanerId]/suspend/route.ts",
  "cleaners/[cleanerId]/reactivate/route.ts",
  "cleaners/[cleanerId]/unsuspend/route.ts",
  "cleaners/[cleanerId]/archive/route.ts",
  "customers/[customerId]/archive/route.ts",
] as const;

/** Matches 5B-2a `cronMutationRoutes.test.ts`. */
export const CRON_POST_ALLOWLIST = [
  "expire-assignment-offers/route.ts",
  "expire-pending-payments/route.ts",
  "recover-assignment-after-payment/route.ts",
  "dispatch-deferred-assignments/route.ts",
  "reconcile-zoho-invoice-payments/route.ts",
] as const;

/** Paystack POST mutation routes (customer + webhook). */
export const PAYSTACK_POST_ALLOWLIST = [
  "initialize/route.ts",
  "initialize-zoho-invoice/route.ts",
  "verify/route.ts",
  "webhook/route.ts",
] as const;

/** Forbidden in lifecycle mutation route files. */
export const FORBIDDEN_ROUTE_LIFECYCLE_PATTERNS: RegExp[] = [
  /\.from\s*\(\s*["']bookings["']\s*\)[\s\S]*?\.update\s*\(/,
  /\.from\s*\(\s*["']payments["']\s*\)[\s\S]*?\.update\s*\(/,
  /\.from\s*\(\s*["']assignment_offers["']\s*\)[\s\S]*?\.update\s*\(/,
  /\.from\s*\(\s*["']assignment_offers["']\s*\)[\s\S]*?\.insert\s*\(/,
  /\.from\s*\(\s*["']earning_lines["']\s*\)[\s\S]*?\.update\s*\(/,
  /\.from\s*\(\s*["']earning_lines["']\s*\)[\s\S]*?\.insert\s*\(/,
  /\bexecuteBookingCommand\s*\(/,
  /\bADMIN_OVERRIDE_STATUS\b/,
];

/** Forbidden in read-only POST route files. */
export const FORBIDDEN_READ_ONLY_POST_PATTERNS: RegExp[] = [
  /from\s+["']@\/lib\/supabase\/serviceRole["']/,
  /\bcreateServiceRoleClient\b/,
  /\brequireServiceRoleClient\b/,
  /\bcreateBookingCommandBackend\b/,
  /\bexecuteBookingCommand\b/,
  /\binitializePayment\b/,
  /\bfinalizePaidBooking\b/,
  /\bhandlePaystackWebhook\b/,
  /\.from\s*\(\s*["']bookings["']\s*\)/,
  /\.from\s*\(\s*["']payments["']\s*\)/,
  /\.from\s*\(\s*["']assignment_offers["']\s*\)/,
  /\.from\s*\(\s*["']earning_lines["']\s*\)/,
];

export const SERVICE_ROLE_IMPORT_PATTERN = /from\s+["']@\/lib\/supabase\/serviceRole["']/;

export const API_ROOT = "src/app/api";
