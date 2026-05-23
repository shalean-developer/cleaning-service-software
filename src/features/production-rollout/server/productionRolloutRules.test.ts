import { describe, expect, it } from "vitest";
import {
  buildRolloutRecommendations,
  evaluateProductionEnvironment,
  evaluateRolloutReadiness,
} from "./productionRolloutRules";
import type { ProductionRolloutChecklistItem } from "./productionRolloutTypes";

function checklistItem(
  key: string,
  completed: boolean,
): ProductionRolloutChecklistItem {
  return {
    id: key,
    checklistKey: key,
    label: key,
    category: "core_setup",
    completed,
    completedBy: null,
    completedAt: null,
    notes: null,
    createdAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("productionRolloutRules", () => {
  it("evaluates invoice payment readiness from env and checklist", () => {
    const readiness = evaluateRolloutReadiness({
      environment: {
        appBaseUrlConfigured: true,
        paystackConfigured: true,
        zohoConfigured: true,
        cronSecretConfigured: true,
        supabaseConfigured: true,
        liveModeDetected: true,
      },
      featureFlags: {
        invoicePaymentsEnabled: false,
        savedMethodsEnabled: false,
        adminCardChargesEnabled: false,
        salesSyncEnabled: false,
        refundCreditSyncEnabled: false,
        vatEnabled: false,
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
      checklist: [checklistItem("webhook_configured", true)],
    });

    expect(readiness.safeForInvoicePayments).toBe(true);
    expect(readiness.safeForAdminCharges).toBe(false);
  });

  it("blocks readiness when reconciliation failures exist", () => {
    const readiness = evaluateRolloutReadiness({
      environment: {
        appBaseUrlConfigured: true,
        paystackConfigured: true,
        zohoConfigured: true,
        cronSecretConfigured: true,
        supabaseConfigured: true,
        liveModeDetected: true,
      },
      featureFlags: {
        invoicePaymentsEnabled: true,
        savedMethodsEnabled: true,
        adminCardChargesEnabled: false,
        salesSyncEnabled: false,
        refundCreditSyncEnabled: false,
        vatEnabled: false,
      },
      operationalHealth: {
        failedReconciliationCount: 2,
        pendingReconciliationCount: 5,
        failedRefundSyncCount: 0,
        stalePendingCount: 1,
        failedZohoSyncCount: 0,
        failedAdminCharges: 0,
        oldestPendingAgeHours: 48,
      },
      checklist: [
        checklistItem("webhook_configured", true),
        checklistItem("live_payment_test_completed", true),
        checklistItem("saved_method_test_completed", true),
      ],
    });

    expect(readiness.safeForInvoicePayments).toBe(false);
    expect(readiness.safeForSalesSync).toBe(false);
  });

  it("builds rollout recommendations including rollback guidance themes", () => {
    const steps = buildRolloutRecommendations({
      environment: evaluateProductionEnvironment(),
      featureFlags: {
        invoicePaymentsEnabled: false,
        savedMethodsEnabled: false,
        adminCardChargesEnabled: false,
        salesSyncEnabled: false,
        refundCreditSyncEnabled: false,
        vatEnabled: false,
      },
      operationalHealth: {
        failedReconciliationCount: 1,
        pendingReconciliationCount: 0,
        failedRefundSyncCount: 0,
        stalePendingCount: 0,
        failedZohoSyncCount: 0,
        failedAdminCharges: 0,
        oldestPendingAgeHours: null,
      },
      readiness: evaluateRolloutReadiness({
        environment: {
          appBaseUrlConfigured: false,
          paystackConfigured: false,
          zohoConfigured: false,
          cronSecretConfigured: false,
          supabaseConfigured: false,
          liveModeDetected: null,
        },
        featureFlags: {
          invoicePaymentsEnabled: false,
          savedMethodsEnabled: false,
          adminCardChargesEnabled: false,
          salesSyncEnabled: false,
          refundCreditSyncEnabled: false,
          vatEnabled: false,
        },
        operationalHealth: {
          failedReconciliationCount: 1,
          pendingReconciliationCount: 0,
          failedRefundSyncCount: 0,
          stalePendingCount: 0,
          failedZohoSyncCount: 0,
          failedAdminCharges: 0,
          oldestPendingAgeHours: null,
        },
        checklist: [],
      }),
      checklist: [],
    });

    expect(steps.some((step) => step.includes("reconciliation"))).toBe(true);
  });
});
