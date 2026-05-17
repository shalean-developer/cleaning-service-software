/**
 * Stage 5B-2c-min: approved route facade internal boundaries.
 * One row per facade module referenced by mutationRouteBoundaryManifest.
 *
 * @see docs/architecture/stage-5b-2c-facade-command-boundary-guard-design.md
 */

export type FacadeBoundaryTier =
  | "command_required"
  | "payment_orchestrator"
  | "lock_infra"
  | "offer_expiry"
  | "read_only";

export type PaymentProcessorSymbol =
  | "processPaystackChargeSuccess"
  | "processPaystackChargeFailure";

export type FacadeBoundaryRule = {
  /** Path relative to `src/` */
  facadeFile: string;
  /** Route-facing export(s) from this module */
  exportSymbols: string[];
  tier: FacadeBoundaryTier;
  /** Tier A: may satisfy boundary via these orchestrator symbols (import or call) */
  allowedOrchestratorSymbols?: string[];
  /** Tier B: must reference each listed payment processor */
  requiredPaymentProcessors?: PaymentProcessorSymbol[];
  /** Must match ALLOWED_SERVICE_ROLE_LIFECYCLE_IMPORTERS when true */
  allowedServiceRoleImport: boolean;
  /** Tier D: direct assignment_offers update allowed (expireOffers.ts only) */
  allowedDirectWriteException: boolean;
};

export const FACADE_SRC_ROOT = "src";

/** Orchestrators that may satisfy `command_required` without a direct `executeBookingCommand(` call. */
export const APPROVED_COMMAND_ORCHESTRATOR_SYMBOLS = [
  "processBookingAfterOfferEnded",
  "processBookingAfterOfferExpiry",
  "createAdminDispatchOffer",
  "createAdminCancelOpenOffer",
  "recoverAssignmentForBooking",
  "runAssignmentAfterPayment",
] as const;

/**
 * Route-referenced facade modules (18 files; 21 export symbols).
 * Derived from `mutationRouteBoundaryManifest.ts` requiredFacadeImports.
 */
export const FACADE_BOUNDARY_RULES: FacadeBoundaryRule[] = [
  {
    facadeFile: "features/bookings/server/lock/createBookingPaymentLock.ts",
    exportSymbols: ["createBookingPaymentLock"],
    tier: "command_required",
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/bookings/server/lock/createPaymentRetryLock.ts",
    exportSymbols: ["createPaymentRetryLock"],
    tier: "lock_infra",
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/payments/server/initializePayment.ts",
    exportSymbols: ["initializePayment"],
    tier: "command_required",
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/payments/server/verifyPayment.ts",
    exportSymbols: ["verifyPayment"],
    tier: "payment_orchestrator",
    requiredPaymentProcessors: ["processPaystackChargeSuccess"],
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/payments/server/handlePaystackWebhook.ts",
    exportSymbols: ["handlePaystackWebhook"],
    tier: "payment_orchestrator",
    requiredPaymentProcessors: [
      "processPaystackChargeSuccess",
      "processPaystackChargeFailure",
    ],
    allowedServiceRoleImport: false,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/assignments/server/respondToOffer.ts",
    exportSymbols: ["acceptCleanerOffer", "declineCleanerOffer"],
    tier: "command_required",
    allowedServiceRoleImport: false,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/assignments/server/handleOfferDeclinedFollowUp.ts",
    exportSymbols: ["handleOfferDeclinedFollowUp"],
    tier: "command_required",
    allowedOrchestratorSymbols: ["processBookingAfterOfferEnded"],
    allowedServiceRoleImport: false,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/earnings/server/completionActions.ts",
    exportSymbols: [
      "startCleanerJob",
      "completeCleanerJob",
      "markBookingPayoutReadyAdmin",
      "markBookingPaidOutAdmin",
    ],
    tier: "command_required",
    allowedServiceRoleImport: false,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/assignments/server/adminManualDispatchOffer.ts",
    exportSymbols: ["runAdminManualDispatchOffer"],
    tier: "command_required",
    allowedOrchestratorSymbols: ["createAdminDispatchOffer"],
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/assignments/server/adminReplaceOpenOffer.ts",
    exportSymbols: ["runAdminReplaceOpenOffer"],
    tier: "command_required",
    allowedOrchestratorSymbols: ["createAdminCancelOpenOffer", "createAdminDispatchOffer"],
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/assignments/server/adminAssignmentRecovery.ts",
    exportSymbols: ["runAdminSingleBookingAssignmentRecovery"],
    tier: "command_required",
    allowedOrchestratorSymbols: ["recoverAssignmentForBooking"],
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/payments/server/expirePendingPayments.ts",
    exportSymbols: ["expireStalePendingPayments"],
    tier: "command_required",
    allowedServiceRoleImport: false,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/assignments/server/expireOffers.ts",
    exportSymbols: ["expireStaleAssignmentOffers"],
    tier: "offer_expiry",
    allowedOrchestratorSymbols: ["processBookingAfterOfferExpiry"],
    allowedServiceRoleImport: false,
    allowedDirectWriteException: true,
  },
  {
    facadeFile: "features/assignments/server/runAssignmentRecovery.ts",
    exportSymbols: ["runAssignmentRecoveryBatch"],
    tier: "command_required",
    allowedOrchestratorSymbols: ["recoverAssignmentForBooking", "runAssignmentAfterPayment"],
    allowedServiceRoleImport: false,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/pricing/server/calculateQuote.ts",
    exportSymbols: ["calculateQuote"],
    tier: "read_only",
    allowedServiceRoleImport: false,
    allowedDirectWriteException: false,
  },
  {
    facadeFile: "features/cleaners/server/getAvailableCleaners.ts",
    exportSymbols: ["getAvailableCleaners", "getBookingCleaners"],
    tier: "read_only",
    allowedServiceRoleImport: true,
    allowedDirectWriteException: false,
  },
];

/** Forbidden lifecycle status / earning / payout writes inside route facades. */
export const FORBIDDEN_FACADE_STATUS_PATTERNS: RegExp[] = [
  /\.from\s*\(\s*["']bookings["']\s*\)[\s\S]*?\.update\s*\(\s*\{[^}]*\bstatus\b/,
  /\.from\s*\(\s*["']payments["']\s*\)[\s\S]*?\.update\s*\(\s*\{[^}]*\bstatus\b/,
  /\.from\s*\(\s*["']assignment_offers["']\s*\)[\s\S]*?\.update\s*\(\s*\{[^}]*\bstatus\b/,
  /\.from\s*\(\s*["']earning_lines["']\s*\)[\s\S]*?\.(update|insert)\s*\(/,
  /\.from\s*\(\s*["']cleaner_payouts["']\s*\)[\s\S]*?\.(update|insert)\s*\(/,
];

/** Any assignment_offers `.update(` (tier D file is exempt). */
export const FORBIDDEN_FACADE_OFFER_UPDATE_PATTERN =
  /\.from\s*\(\s*["']assignment_offers["']\s*\)[\s\S]*?\.update\s*\(/;

/** Forbidden in read-only facades (service role allowed only when manifest permits). */
export const FORBIDDEN_READ_ONLY_FACADE_PATTERNS: RegExp[] = [
  /\bexecuteBookingCommand\s*\(/,
  /\bcreateBookingCommandBackend\b/,
  /\bfinalizePaidBooking\b/,
  /\bprocessPaystackChargeSuccess\b/,
  /\bprocessPaystackChargeFailure\b/,
  /\bhandlePaystackWebhook\b/,
  /\binitializePayment\b/,
  /\bADMIN_OVERRIDE_STATUS\b/,
];

export const SERVICE_ROLE_IMPORT_PATTERN =
  /from\s+["']@\/lib\/supabase\/serviceRole["']/;

export const EXECUTE_BOOKING_COMMAND_PATTERN = /\bexecuteBookingCommand\s*\(/;

export const ADMIN_OVERRIDE_PATTERN = /\bADMIN_OVERRIDE_STATUS\b/;

/** Route manifest symbols → facade file (for cross-check tests). */
export const ROUTE_FACADE_SYMBOL_TO_FILE: Record<string, string> = {
  createBookingPaymentLock: "features/bookings/server/lock/createBookingPaymentLock.ts",
  createPaymentRetryLock: "features/bookings/server/lock/createPaymentRetryLock.ts",
  initializePayment: "features/payments/server/initializePayment.ts",
  verifyPayment: "features/payments/server/verifyPayment.ts",
  handlePaystackWebhook: "features/payments/server/handlePaystackWebhook.ts",
  acceptCleanerOffer: "features/assignments/server/respondToOffer.ts",
  declineCleanerOffer: "features/assignments/server/respondToOffer.ts",
  handleOfferDeclinedFollowUp: "features/assignments/server/handleOfferDeclinedFollowUp.ts",
  startCleanerJob: "features/earnings/server/completionActions.ts",
  completeCleanerJob: "features/earnings/server/completionActions.ts",
  markBookingPayoutReadyAdmin: "features/earnings/server/completionActions.ts",
  markBookingPaidOutAdmin: "features/earnings/server/completionActions.ts",
  runAdminManualDispatchOffer: "features/assignments/server/adminManualDispatchOffer.ts",
  runAdminReplaceOpenOffer: "features/assignments/server/adminReplaceOpenOffer.ts",
  runAdminSingleBookingAssignmentRecovery:
    "features/assignments/server/adminAssignmentRecovery.ts",
  expireStalePendingPayments: "features/payments/server/expirePendingPayments.ts",
  expireStaleAssignmentOffers: "features/assignments/server/expireOffers.ts",
  runAssignmentRecoveryBatch: "features/assignments/server/runAssignmentRecovery.ts",
  calculateQuote: "features/pricing/server/calculateQuote.ts",
  getAvailableCleaners: "features/cleaners/server/getAvailableCleaners.ts",
  getBookingCleaners: "features/cleaners/server/getAvailableCleaners.ts",
};
