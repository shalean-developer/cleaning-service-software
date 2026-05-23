import "server-only";

export type ProductionRolloutChecklistCategory =
  | "core_setup"
  | "live_qa"
  | "controlled_rollout"
  | "final_enablement"
  | "admin_assisted_booking";

export type ProductionRolloutChecklistItem = {
  id: string;
  checklistKey: string;
  label: string;
  category: ProductionRolloutChecklistCategory;
  completed: boolean;
  completedBy: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
};

export type ProductionRolloutEnvironment = {
  appBaseUrlConfigured: boolean;
  paystackConfigured: boolean;
  zohoConfigured: boolean;
  cronSecretConfigured: boolean;
  supabaseConfigured: boolean;
  liveModeDetected: boolean | null;
};

export type ProductionRolloutFeatureFlags = {
  invoicePaymentsEnabled: boolean;
  savedMethodsEnabled: boolean;
  adminCardChargesEnabled: boolean;
  salesSyncEnabled: boolean;
  refundCreditSyncEnabled: boolean;
  vatEnabled: boolean;
};

export type ProductionRolloutOperationalHealth = {
  failedReconciliationCount: number;
  pendingReconciliationCount: number;
  failedRefundSyncCount: number;
  stalePendingCount: number;
  failedZohoSyncCount: number;
  failedAdminCharges: number;
  oldestPendingAgeHours: number | null;
};

export type ProductionRolloutReadiness = {
  safeForInvoicePayments: boolean;
  safeForSavedMethods: boolean;
  safeForSalesSync: boolean;
  safeForRefundSync: boolean;
  safeForAdminCharges: boolean;
};

export type ProductionRolloutStatus = {
  environment: ProductionRolloutEnvironment;
  featureFlags: ProductionRolloutFeatureFlags;
  operationalHealth: ProductionRolloutOperationalHealth;
  rolloutReadiness: ProductionRolloutReadiness;
  recommendedNextSteps: string[];
  checklist: ProductionRolloutChecklistItem[];
  adminAssistedDiagnostics: import("@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel").AdminAssistedBookingDiagnostics;
};

export type RecommendedFeatureFlagChange = {
  flag: string;
  currentValue: boolean;
  recommendedValue: boolean;
  reason: string;
};

export type FeatureFlagRecommendations = {
  currentFlags: ProductionRolloutFeatureFlags;
  recommendedChanges: RecommendedFeatureFlagChange[];
  warnings: string[];
};

export const PRODUCTION_ROLLOUT_CHECKLIST_KEYS = [
  "app_base_url_configured",
  "webhook_configured",
  "zoho_oauth_configured",
  "cron_configured",
  "live_payment_test_completed",
  "saved_method_test_completed",
  "refund_test_completed",
  "finance_reconciliation_reviewed",
  "accounting_close_reviewed",
  "invoice_payments_rollout_ack",
  "saved_methods_rollout_ack",
  "sales_sync_rollout_ack",
  "refund_sync_rollout_ack",
  "admin_charges_disabled_ack",
  "admin_charge_test_completed",
  "admin_assisted_booking_draft_tested",
  "admin_assisted_pending_payment_tested",
  "admin_assisted_payment_link_tested",
  "admin_assisted_payment_request_email_tested",
  "admin_assisted_offline_payment_eft_tested",
  "admin_assisted_offline_payment_cash_tested",
  "admin_assisted_offline_payment_card_machine_tested",
  "admin_assisted_assignment_parity_verified",
  "admin_assisted_customer_visibility_verified",
  "admin_assisted_cleaner_visibility_verified",
  "admin_assisted_payout_safety_verified",
  "admin_assisted_webhook_parity_verified",
  "admin_assisted_feature_flags_verified",
] as const;

export type ProductionRolloutChecklistKey = (typeof PRODUCTION_ROLLOUT_CHECKLIST_KEYS)[number];

export const CRITICAL_RECONCILIATION_FAILURE_THRESHOLD = 0;
export const ADMIN_CHARGE_FAILURE_THRESHOLD = 3;
export const SYNC_BACKLOG_THRESHOLD = 10;
export const STALE_PENDING_DAYS = 7;
