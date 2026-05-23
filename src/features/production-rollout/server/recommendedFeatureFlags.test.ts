import { describe, expect, it } from "vitest";
import { buildFeatureFlagRecommendations } from "./recommendedFeatureFlags";

describe("recommendedFeatureFlags", () => {
  it("warns when sales sync enabled with unstable reconciliation", () => {
    const result = buildFeatureFlagRecommendations({
      currentFlags: {
        invoicePaymentsEnabled: true,
        savedMethodsEnabled: true,
        adminCardChargesEnabled: false,
        salesSyncEnabled: true,
        refundCreditSyncEnabled: false,
        vatEnabled: false,
      },
      readiness: {
        safeForInvoicePayments: true,
        safeForSavedMethods: true,
        safeForSalesSync: false,
        safeForRefundSync: false,
        safeForAdminCharges: false,
      },
      operationalHealth: {
        failedReconciliationCount: 3,
        pendingReconciliationCount: 12,
        failedRefundSyncCount: 0,
        stalePendingCount: 0,
        failedZohoSyncCount: 0,
        failedAdminCharges: 0,
        oldestPendingAgeHours: null,
      },
    });

    expect(result.warnings.some((w) => w.includes("reconciliation"))).toBe(true);
  });

  it("recommends enabling saved methods when readiness passes", () => {
    const result = buildFeatureFlagRecommendations({
      currentFlags: {
        invoicePaymentsEnabled: true,
        savedMethodsEnabled: false,
        adminCardChargesEnabled: false,
        salesSyncEnabled: false,
        refundCreditSyncEnabled: false,
        vatEnabled: false,
      },
      readiness: {
        safeForInvoicePayments: true,
        safeForSavedMethods: true,
        safeForSalesSync: false,
        safeForRefundSync: false,
        safeForAdminCharges: false,
      },
      operationalHealth: {
        failedReconciliationCount: 0,
        pendingReconciliationCount: 0,
        failedRefundSyncCount: 0,
        stalePendingCount: 0,
        failedZohoSyncCount: 0,
        failedAdminCharges: 0,
        oldestPendingAgeHours: null,
      },
    });

    expect(result.recommendedChanges).toContainEqual(
      expect.objectContaining({ flag: "ZOHO_SAVED_METHODS_ENABLED", recommendedValue: true }),
    );
  });
});
