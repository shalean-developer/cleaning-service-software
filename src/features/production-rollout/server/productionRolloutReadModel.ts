import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { countReconciliationFailures } from "@/features/finance-analytics/server/financeAnalyticsCalculations";
import { loadFinanceReconciliationForExport } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { listProductionRolloutChecklist } from "./productionRolloutChecklistRepository";
import { logProductionRolloutEvent } from "./productionRolloutLogger";
import { loadAdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";
import {
  buildRolloutRecommendations,
  evaluateProductionEnvironment,
  evaluateRolloutReadiness,
} from "./productionRolloutRules";
import { buildFeatureFlagRecommendations, readCurrentFeatureFlags } from "./recommendedFeatureFlags";
import type {
  FeatureFlagRecommendations,
  ProductionRolloutOperationalHealth,
  ProductionRolloutStatus,
} from "./productionRolloutTypes";
import { STALE_PENDING_DAYS } from "./productionRolloutTypes";

function stalePendingCutoff(referenceDate: Date = new Date()): string {
  const cutoff = new Date(referenceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_PENDING_DAYS);
  return cutoff.toISOString();
}

async function loadOperationalHealth(
  client: SupabaseClient<Database>,
): Promise<ProductionRolloutOperationalHealth> {
  const staleBefore = stalePendingCutoff();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

  const [
    reconciliationItems,
    failedRefundSync,
    pendingRefundSync,
    failedSalesSync,
    pendingSalesSync,
    failedAdminCharges,
    failedAdminReconcile,
  ] = await Promise.all([
    loadFinanceReconciliationForExport(
      { from: thirtyDaysAgo.toISOString() },
      client,
    ),
    client
      .from("zoho_refund_credit_sync")
      .select("id", { count: "exact", head: true })
      .eq("sync_status", "failed"),
    client
      .from("zoho_refund_credit_sync")
      .select("id", { count: "exact", head: true })
      .eq("sync_status", "pending"),
    client
      .from("zoho_sales_sync")
      .select("id", { count: "exact", head: true })
      .eq("sync_status", "failed"),
    client
      .from("zoho_sales_sync")
      .select("id", { count: "exact", head: true })
      .eq("sync_status", "pending"),
    client
      .from("zoho_invoice_authorization_charges")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    client
      .from("zoho_invoice_authorization_charges")
      .select("id", { count: "exact", head: true })
      .eq("status", "zoho_reconcile_failed"),
  ]);

  if (failedRefundSync.error) throw new Error(failedRefundSync.error.message);
  if (pendingRefundSync.error) throw new Error(pendingRefundSync.error.message);
  if (failedSalesSync.error) throw new Error(failedSalesSync.error.message);
  if (pendingSalesSync.error) throw new Error(pendingSalesSync.error.message);
  if (failedAdminCharges.error) throw new Error(failedAdminCharges.error.message);
  if (failedAdminReconcile.error) throw new Error(failedAdminReconcile.error.message);

  const stalePendingCount = reconciliationItems.filter((item) => {
    if (item.reconciliationStatus !== "pending") return false;
    return new Date(item.createdAt).getTime() < new Date(staleBefore).getTime();
  }).length;

  const pendingItems = reconciliationItems.filter(
    (item) => item.reconciliationStatus === "pending",
  );
  const oldestPending = pendingItems.reduce<string | null>((oldest, item) => {
    const ts = item.createdAt;
    if (!oldest || ts < oldest) return ts;
    return oldest;
  }, null);

  const oldestPendingAgeHours = oldestPending
    ? Math.round((Date.now() - new Date(oldestPending).getTime()) / (1000 * 60 * 60))
    : null;

  return {
    failedReconciliationCount: countReconciliationFailures(reconciliationItems),
    pendingReconciliationCount: pendingItems.length,
    failedRefundSyncCount: failedRefundSync.count ?? 0,
    stalePendingCount,
    failedZohoSyncCount: failedSalesSync.count ?? 0,
    failedAdminCharges: (failedAdminCharges.count ?? 0) + (failedAdminReconcile.count ?? 0),
    oldestPendingAgeHours,
  };
}

export async function loadProductionRolloutStatus(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ProductionRolloutStatus & { featureFlagRecommendations: FeatureFlagRecommendations }> {
  try {
    const [checklist, operationalHealth, adminAssistedDiagnostics] = await Promise.all([
      listProductionRolloutChecklist(client),
      loadOperationalHealth(client),
      loadAdminAssistedBookingDiagnostics(client),
    ]);

    const environment = evaluateProductionEnvironment();
    const featureFlags = readCurrentFeatureFlags();
    const rolloutReadiness = evaluateRolloutReadiness({
      environment,
      featureFlags,
      operationalHealth,
      checklist,
    });
    const recommendedNextSteps = buildRolloutRecommendations({
      environment,
      featureFlags,
      operationalHealth,
      readiness: rolloutReadiness,
      checklist,
    });
    const featureFlagRecommendations = buildFeatureFlagRecommendations({
      currentFlags: featureFlags,
      readiness: rolloutReadiness,
      operationalHealth,
    });

    logProductionRolloutEvent("production_rollout_loaded", {
      checklistCompleted: checklist.filter((item) => item.completed).length,
      safeForInvoicePayments: rolloutReadiness.safeForInvoicePayments,
    });

    return {
      environment,
      featureFlags,
      operationalHealth,
      rolloutReadiness,
      recommendedNextSteps,
      checklist,
      adminAssistedDiagnostics,
      featureFlagRecommendations,
    };
  } catch {
    logProductionRolloutEvent("production_rollout_failed", { stage: "load" });
    throw new Error("Could not load production rollout status.");
  }
}

export async function loadProductionRolloutForExport(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ProductionRolloutStatus & { featureFlagRecommendations: FeatureFlagRecommendations }> {
  return loadProductionRolloutStatus(client);
}

/** @internal exported for tests */
export { loadOperationalHealth, stalePendingCutoff };
