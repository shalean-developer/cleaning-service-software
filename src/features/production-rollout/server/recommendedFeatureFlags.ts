import "server-only";

import { getShaleanVatConfig } from "@/features/tax-reports/server/shaleanVatConfig";
import { getZohoPaymentFeatureState } from "@/features/zoho-invoice-payments/server/zohoPaymentLaunchGuard";
import { isZohoRefundCreditSyncEnabled } from "@/features/zoho-sales-sync/server/zohoRefundCreditSyncLaunchGuard";
import { isZohoSalesSyncEnabled } from "@/features/zoho-sales-sync/server/zohoSalesSyncLaunchGuard";
import type {
  FeatureFlagRecommendations,
  ProductionRolloutFeatureFlags,
  ProductionRolloutOperationalHealth,
  ProductionRolloutReadiness,
} from "./productionRolloutTypes";

export function readCurrentFeatureFlags(): ProductionRolloutFeatureFlags {
  const paymentState = getZohoPaymentFeatureState();
  const vat = getShaleanVatConfig();

  return {
    invoicePaymentsEnabled: paymentState.invoicePaymentsEnabled,
    savedMethodsEnabled: paymentState.savedMethodsEnabled,
    adminCardChargesEnabled: paymentState.adminCardChargesEnabled,
    salesSyncEnabled: isZohoSalesSyncEnabled(),
    refundCreditSyncEnabled: isZohoRefundCreditSyncEnabled(),
    vatEnabled: vat.vatRegistered,
  };
}

export function buildFeatureFlagRecommendations(input: {
  currentFlags: ProductionRolloutFeatureFlags;
  readiness: ProductionRolloutReadiness;
  operationalHealth: ProductionRolloutOperationalHealth;
}): FeatureFlagRecommendations {
  const { currentFlags, readiness, operationalHealth } = input;
  const recommendedChanges: FeatureFlagRecommendations["recommendedChanges"] = [];
  const warnings: string[] = [];

  if (
    currentFlags.salesSyncEnabled &&
    (operationalHealth.failedReconciliationCount > 0 ||
      operationalHealth.pendingReconciliationCount > 10)
  ) {
    warnings.push(
      "Sales sync is enabled while reconciliation is not stable — accounting mismatches may increase.",
    );
  }

  if (currentFlags.refundCreditSyncEnabled && !currentFlags.salesSyncEnabled) {
    warnings.push("Refund/credit sync is enabled without sales sync — review dependency order.");
  }

  if (currentFlags.adminCardChargesEnabled && operationalHealth.failedAdminCharges > 0) {
    warnings.push(
      "Admin card charges are enabled with recent failures — consider disabling ZOHO_ADMIN_CARD_CHARGES_ENABLED.",
    );
  }

  if (currentFlags.savedMethodsEnabled && !currentFlags.invoicePaymentsEnabled) {
    warnings.push("Saved methods are enabled while invoice payments are disabled — unexpected state.");
  }

  if (!currentFlags.invoicePaymentsEnabled && readiness.safeForInvoicePayments) {
    recommendedChanges.push({
      flag: "ZOHO_INVOICE_PAYMENTS_ENABLED",
      currentValue: false,
      recommendedValue: true,
      reason: "Environment and reconciliation checks passed for invoice payments.",
    });
  }

  if (
    currentFlags.invoicePaymentsEnabled &&
    !currentFlags.savedMethodsEnabled &&
    readiness.safeForSavedMethods
  ) {
    recommendedChanges.push({
      flag: "ZOHO_SAVED_METHODS_ENABLED",
      currentValue: false,
      recommendedValue: true,
      reason: "Invoice payments stable; saved-method QA complete.",
    });
  }

  if (
    currentFlags.savedMethodsEnabled &&
    !currentFlags.salesSyncEnabled &&
    readiness.safeForSalesSync
  ) {
    recommendedChanges.push({
      flag: "ZOHO_SALES_SYNC_ENABLED",
      currentValue: false,
      recommendedValue: true,
      reason: "Reconciliation healthy and invoice payment track record stable.",
    });
  }

  if (
    currentFlags.salesSyncEnabled &&
    !currentFlags.refundCreditSyncEnabled &&
    readiness.safeForRefundSync
  ) {
    recommendedChanges.push({
      flag: "ZOHO_REFUND_CREDIT_SYNC_ENABLED",
      currentValue: false,
      recommendedValue: true,
      reason: "Sales sync enabled with no failed refund sync backlog.",
    });
  }

  if (
    currentFlags.savedMethodsEnabled &&
    !currentFlags.adminCardChargesEnabled &&
    readiness.safeForAdminCharges
  ) {
    recommendedChanges.push({
      flag: "ZOHO_ADMIN_CARD_CHARGES_ENABLED",
      currentValue: false,
      recommendedValue: true,
      reason: "Final sign-off: saved methods stable and reconciliation clean.",
    });
  }

  if (operationalHealth.failedReconciliationCount > 0) {
    warnings.push("Keep admin card charges disabled until reconciliation backlog is zero.");
  }

  if (operationalHealth.failedZohoSyncCount > 0) {
    warnings.push("Review failed syncs before enabling refund sync.");
  }

  return {
    currentFlags,
    recommendedChanges,
    warnings,
  };
}
