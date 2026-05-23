import "server-only";

import { getPaystackMode } from "@/features/zoho-invoice-payments/server/zohoPaymentLaunchGuard";
import { isPaystackEnabled } from "@/features/payments/server/paystackEnv";
import { getServerAppBaseUrl, isLocalhostAppBaseUrl } from "@/lib/app/appBaseUrl";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";
import type {
  ProductionRolloutChecklistItem,
  ProductionRolloutEnvironment,
  ProductionRolloutFeatureFlags,
  ProductionRolloutOperationalHealth,
  ProductionRolloutReadiness,
} from "./productionRolloutTypes";
import {
  ADMIN_CHARGE_FAILURE_THRESHOLD,
  CRITICAL_RECONCILIATION_FAILURE_THRESHOLD,
  STALE_PENDING_DAYS,
  SYNC_BACKLOG_THRESHOLD,
} from "./productionRolloutTypes";
import { isInvalidAdminAssistedFlagCombination } from "@/lib/app/resolveAdminAssistedBookingRolloutStage";
import { evaluateAdminAssistedRolloutReadiness } from "@/features/bookings/server/admin/adminAssistedRolloutReadiness";

export function evaluateProductionEnvironment(): ProductionRolloutEnvironment {
  const appBaseUrl = getServerAppBaseUrl();
  const appBaseUrlConfigured = Boolean(appBaseUrl && !isLocalhostAppBaseUrl(appBaseUrl));
  const paystackMode = getPaystackMode();

  return {
    appBaseUrlConfigured,
    paystackConfigured: isPaystackEnabled(),
    zohoConfigured: isZohoBooksEnabled(),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ),
    liveModeDetected: paystackMode === "disabled" ? null : paystackMode === "live",
  };
}

function checklistCompleted(
  checklist: ProductionRolloutChecklistItem[],
  key: string,
): boolean {
  return checklist.find((item) => item.checklistKey === key)?.completed ?? false;
}

export function evaluateRolloutReadiness(input: {
  environment: ProductionRolloutEnvironment;
  featureFlags: ProductionRolloutFeatureFlags;
  operationalHealth: ProductionRolloutOperationalHealth;
  checklist: ProductionRolloutChecklistItem[];
}): ProductionRolloutReadiness {
  const { environment, featureFlags, operationalHealth, checklist } = input;

  const reconciliationHealthy =
    operationalHealth.failedReconciliationCount <= CRITICAL_RECONCILIATION_FAILURE_THRESHOLD &&
    operationalHealth.stalePendingCount === 0;

  const webhookReady = checklistCompleted(checklist, "webhook_configured");
  const invoicePaymentsStable =
    checklistCompleted(checklist, "live_payment_test_completed") &&
    operationalHealth.failedReconciliationCount <= CRITICAL_RECONCILIATION_FAILURE_THRESHOLD;

  const savedMethodsStable =
    featureFlags.invoicePaymentsEnabled &&
    checklistCompleted(checklist, "saved_method_test_completed") &&
    operationalHealth.failedAdminCharges <= ADMIN_CHARGE_FAILURE_THRESHOLD;

  const salesSyncHealthy =
    environment.zohoConfigured &&
    operationalHealth.failedZohoSyncCount === 0 &&
    operationalHealth.pendingReconciliationCount <= SYNC_BACKLOG_THRESHOLD &&
    reconciliationHealthy;

  const refundSyncHealthy =
    featureFlags.salesSyncEnabled &&
    operationalHealth.failedRefundSyncCount === 0 &&
    checklistCompleted(checklist, "refund_test_completed");

  const adminChargesStable =
    featureFlags.savedMethodsEnabled &&
    savedMethodsStable &&
    reconciliationHealthy &&
    operationalHealth.failedAdminCharges <= ADMIN_CHARGE_FAILURE_THRESHOLD &&
    checklistCompleted(checklist, "admin_charge_test_completed");

  return {
    safeForInvoicePayments:
      environment.paystackConfigured &&
      environment.zohoConfigured &&
      webhookReady &&
      reconciliationHealthy,
    safeForSavedMethods:
      featureFlags.invoicePaymentsEnabled && invoicePaymentsStable && savedMethodsStable,
    safeForSalesSync: salesSyncHealthy && invoicePaymentsStable,
    safeForRefundSync: refundSyncHealthy && salesSyncHealthy,
    safeForAdminCharges: adminChargesStable,
  };
}

export function buildRolloutRecommendations(input: {
  environment: ProductionRolloutEnvironment;
  featureFlags: ProductionRolloutFeatureFlags;
  operationalHealth: ProductionRolloutOperationalHealth;
  readiness: ProductionRolloutReadiness;
  checklist: ProductionRolloutChecklistItem[];
}): string[] {
  const steps: string[] = [];
  const { environment, featureFlags, operationalHealth, readiness, checklist } = input;

  if (!environment.appBaseUrlConfigured) {
    steps.push("Set production APP_BASE_URL before enabling live invoice payments.");
  }
  if (!environment.paystackConfigured) {
    steps.push("Configure Paystack (PAYSTACK_SECRET_KEY) before go-live.");
  }
  if (!environment.zohoConfigured) {
    steps.push("Complete Zoho OAuth and Books configuration.");
  }
  if (!checklistCompleted(checklist, "webhook_configured")) {
    steps.push("Confirm Paystack live webhook is configured and mark webhook_configured.");
  }
  if (!checklistCompleted(checklist, "cron_configured")) {
    steps.push("Schedule reconcile, sales sync, and refund sync crons; mark cron_configured.");
  }
  if (operationalHealth.failedReconciliationCount > 0) {
    steps.push("Resolve failed finance reconciliation items before enabling more features.");
  }
  if (operationalHealth.stalePendingCount > 0) {
    steps.push(
      `Review ${operationalHealth.stalePendingCount} stale pending finance items (>${STALE_PENDING_DAYS} days).`,
    );
  }
  if (!featureFlags.invoicePaymentsEnabled && readiness.safeForInvoicePayments) {
    steps.push("Ready to enable ZOHO_INVOICE_PAYMENTS_ENABLED after final QA sign-off.");
  }
  if (
    featureFlags.invoicePaymentsEnabled &&
    !featureFlags.savedMethodsEnabled &&
    readiness.safeForSavedMethods
  ) {
    steps.push("Enable ZOHO_SAVED_METHODS_ENABLED after saved-method live test.");
  }
  if (
    featureFlags.savedMethodsEnabled &&
    !featureFlags.salesSyncEnabled &&
    readiness.safeForSalesSync
  ) {
    steps.push(
      "Enable ZOHO_SALES_SYNC_ENABLED only after 7+ days of stable invoice payments and clean reconciliation.",
    );
  }
  if (
    featureFlags.salesSyncEnabled &&
    !featureFlags.refundCreditSyncEnabled &&
    readiness.safeForRefundSync
  ) {
    steps.push("Enable ZOHO_REFUND_CREDIT_SYNC_ENABLED after reviewing failed sync backlog.");
  }
  if (
    featureFlags.savedMethodsEnabled &&
    !featureFlags.adminCardChargesEnabled &&
    readiness.safeForAdminCharges
  ) {
    steps.push(
      "Admin card charges may be enabled last — keep ZOHO_ADMIN_CARD_CHARGES_ENABLED=false until explicit sign-off.",
    );
  } else if (featureFlags.adminCardChargesEnabled) {
    steps.push("Admin card charges are enabled — monitor failed charge rate daily.");
  }
  if (operationalHealth.failedZohoSyncCount > 0) {
    steps.push("Review failed Zoho sales sync records before expanding rollout.");
  }
  if (operationalHealth.failedRefundSyncCount > 0) {
    steps.push("Clear failed refund/credit sync backlog before enabling refund sync broadly.");
  }
  if (operationalHealth.pendingReconciliationCount > SYNC_BACKLOG_THRESHOLD) {
    steps.push("Reconciliation backlog is elevated — stabilize before enabling sales sync.");
  }

  const adminAssistedReadiness = evaluateAdminAssistedRolloutReadiness(checklist);
  if (isInvalidAdminAssistedFlagCombination()) {
    steps.push(
      "Admin assisted booking flags are in an invalid combination — resolve before expanding rollout.",
    );
  }
  if (adminAssistedReadiness.unresolvedBlockers.length > 0) {
    steps.push(
      `Admin assisted booking blockers: ${adminAssistedReadiness.unresolvedBlockers.join("; ")}`,
    );
  } else if (!adminAssistedReadiness.productionReady) {
    steps.push(
      `Complete admin assisted checklist (${adminAssistedReadiness.checklistProgress.completed}/${adminAssistedReadiness.checklistProgress.total}) before production rollout.`,
    );
  }

  if (steps.length === 0) {
    steps.push("Rollout checks passed — continue monitoring finance dashboards daily.");
  }

  return steps;
}
