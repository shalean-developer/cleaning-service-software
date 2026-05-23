import Link from "next/link";
import { AdminAssistedBookingDiagnosticsPanel } from "@/components/dashboard/admin/AdminAssistedBookingDiagnosticsPanel";
import { AdminAssistedRolloutStageBadge } from "@/components/dashboard/admin/AdminAssistedRolloutStageBadge";
import { AdminProductionRolloutChecklistItem } from "@/components/dashboard/admin/AdminProductionRolloutChecklistItem";
import type {
  FeatureFlagRecommendations,
  ProductionRolloutChecklistCategory,
  ProductionRolloutChecklistItem,
  ProductionRolloutStatus,
} from "@/features/production-rollout/server/productionRolloutTypes";

type Props = {
  data: ProductionRolloutStatus & { featureFlagRecommendations: FeatureFlagRecommendations };
};

const ROLLOUT_DISCLAIMER =
  "This page is read-only for finance operations. Feature flags are changed via environment variables — not from this dashboard.";

const EMERGENCY_ROLLBACK = [
  "Disable feature flags first (ZOHO_ADMIN_CARD_CHARGES_ENABLED, then refund/sales sync, then saved methods, then invoice payments).",
  "Keep diagnostics pages online — finance reconciliation, Zoho payments, and finance analytics remain available.",
  "Never delete finance records during rollback.",
  "Review failed reconciliation and sync queues before re-enabling.",
];

const CATEGORY_LABELS: Record<ProductionRolloutChecklistCategory, string> = {
  core_setup: "A. Core setup",
  live_qa: "B. Live QA",
  controlled_rollout: "C. Controlled rollout",
  final_enablement: "D. Final enablement",
  admin_assisted_booking: "E. Admin-assisted booking",
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
      }`}
    >
      {label}: {ok ? "Ready" : "Review"}
    </span>
  );
}

function FlagBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        enabled ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
      }`}
    >
      {label}: {enabled ? "ON" : "OFF"}
    </span>
  );
}

function ChecklistSection({
  category,
  items,
}: {
  category: ProductionRolloutChecklistCategory;
  items: ProductionRolloutChecklistItem[];
}) {
  const sectionItems = items.filter((item) => item.category === category);
  if (sectionItems.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-900">{CATEGORY_LABELS[category]}</h3>
      <div className="space-y-2">
        {sectionItems.map((item) => (
          <AdminProductionRolloutChecklistItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

export function AdminProductionRolloutDashboard({ data }: Props) {
  const {
    environment,
    featureFlags,
    operationalHealth,
    rolloutReadiness,
    recommendedNextSteps,
    featureFlagRecommendations,
    checklist,
    adminAssistedDiagnostics,
    adminAssistedReadiness,
  } = data;

  const exportHref = "/api/admin/production-rollout/export?format=csv";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {ROLLOUT_DISCLAIMER}
      </section>

      {featureFlagRecommendations.warnings.length > 0 ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <h2 className="font-semibold">Warnings</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {featureFlagRecommendations.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Environment readiness</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-zinc-500">APP_BASE_URL</dt>
            <dd>{environment.appBaseUrlConfigured ? "Configured" : "Review"}</dd>
          </div>
          
          <div>
            <dt className="text-xs font-medium text-zinc-500">Paystack</dt>
            <dd>{environment.paystackConfigured ? "Configured" : "Missing"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Zoho Books</dt>
            <dd>{environment.zohoConfigured ? "Configured" : "Missing"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Cron secret</dt>
            <dd>{environment.cronSecretConfigured ? "Configured" : "Missing"}</dd>
          </div>
          
          
          <div>
            <dt className="text-xs font-medium text-zinc-500">Supabase</dt>
            <dd>{environment.supabaseConfigured ? "Configured" : "Missing"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500">Live mode detected</dt>
            <dd>
              {environment.liveModeDetected == null
                ? "Unknown"
                : environment.liveModeDetected
                  ? "Yes"
                  : "No (test/disabled)"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Feature flag readiness</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <FlagBadge enabled={featureFlags.invoicePaymentsEnabled} label="Invoice payments" />
          <FlagBadge enabled={featureFlags.savedMethodsEnabled} label="Saved methods" />
          <FlagBadge enabled={featureFlags.adminCardChargesEnabled} label="Admin charges" />
          <FlagBadge enabled={featureFlags.salesSyncEnabled} label="Sales sync" />
          <FlagBadge enabled={featureFlags.refundCreditSyncEnabled} label="Refund sync" />
          <FlagBadge enabled={featureFlags.vatEnabled} label="VAT reporting" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusPill ok={rolloutReadiness.safeForInvoicePayments} label="Invoice payments" />
          <StatusPill ok={rolloutReadiness.safeForSavedMethods} label="Saved methods" />
          <StatusPill ok={rolloutReadiness.safeForSalesSync} label="Sales sync" />
          <StatusPill ok={rolloutReadiness.safeForRefundSync} label="Refund sync" />
          <StatusPill ok={rolloutReadiness.safeForAdminCharges} label="Admin charges" />
        </div>
      </section>

      {!adminAssistedReadiness.productionReady ? (
        <section
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
          data-testid="admin-assisted-production-readiness-warning"
        >
          <p className="font-semibold">Admin-assisted booking not production-ready</p>
          <p className="mt-1">
            Checklist {adminAssistedReadiness.checklistProgress.completed}/
            {adminAssistedReadiness.checklistProgress.total} complete (
            {adminAssistedReadiness.checklistProgress.percent}%). Critical{" "}
            {adminAssistedReadiness.criticalProgress.completed}/
            {adminAssistedReadiness.criticalProgress.total}.
          </p>
          {adminAssistedReadiness.unresolvedBlockers.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {adminAssistedReadiness.unresolvedBlockers.slice(0, 5).map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
              {adminAssistedReadiness.unresolvedBlockers.length > 5 ? (
                <li>…and {adminAssistedReadiness.unresolvedBlockers.length - 5} more</li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : (
        <section
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
          data-testid="admin-assisted-production-ready"
        >
          <p className="font-semibold">Admin-assisted booking production-ready</p>
          {adminAssistedReadiness.lastVerifiedAt ? (
            <p className="mt-1 text-xs">
              Last verified {new Date(adminAssistedReadiness.lastVerifiedAt).toLocaleString("en-ZA")}
              {adminAssistedReadiness.lastVerifiedBy
                ? ` by ${adminAssistedReadiness.lastVerifiedBy}`
                : ""}
              .
            </p>
          ) : null}
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Admin-assisted rollout governance</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Derived from env flags and checklist — flags are not changed from this page.
            </p>
          </div>
          <AdminAssistedRolloutStageBadge
            stage={adminAssistedReadiness.rolloutStage}
            description={adminAssistedReadiness.rolloutStageDescription}
          />
        </div>
      </section>

      <AdminAssistedBookingDiagnosticsPanel diagnostics={adminAssistedDiagnostics} />

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Monitoring</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Failed reconciliation</p>
            <p className="text-xl font-semibold tabular-nums">
              {operationalHealth.failedReconciliationCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Pending reconciliation</p>
            <p className="text-xl font-semibold tabular-nums">
              {operationalHealth.pendingReconciliationCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Stale pending items</p>
            <p className="text-xl font-semibold tabular-nums">
              {operationalHealth.stalePendingCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Failed refund sync</p>
            <p className="text-xl font-semibold tabular-nums">
              {operationalHealth.failedRefundSyncCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Failed Zoho sales sync</p>
            <p className="text-xl font-semibold tabular-nums">
              {operationalHealth.failedZohoSyncCount}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Failed admin charges</p>
            <p className="text-xl font-semibold tabular-nums">
              {operationalHealth.failedAdminCharges}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 p-3">
            <p className="text-xs text-zinc-500">Oldest pending age</p>
            <p className="text-xl font-semibold tabular-nums">
              {operationalHealth.oldestPendingAgeHours != null
                ? `${operationalHealth.oldestPendingAgeHours}h`
                : "—"}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Drill down:{" "}
          <Link href="/admin/operations/finance-reconciliation" className="underline">
            Reconciliation
          </Link>
          {" · "}
          <Link href="/admin/operations/accounting-close" className="underline">
            Accounting close
          </Link>
          {" · "}
          <Link href="/admin/operations/finance-analytics" className="underline">
            Finance analytics
          </Link>
          {" · "}
          <Link href="/admin/operations/zoho-payments" className="underline">
            Zoho payments
          </Link>
          {" · "}
          <Link href="/admin/operations/zoho-refunds" className="underline">
            Zoho refunds
          </Link>
        </p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Live QA checklist</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Persisted rollout sign-off items. Checklist updates are audit-friendly; no deletes.
          </p>
        </div>
        <ChecklistSection category="core_setup" items={checklist} />
        <ChecklistSection category="live_qa" items={checklist} />
        <ChecklistSection category="controlled_rollout" items={checklist} />
        <ChecklistSection category="final_enablement" items={checklist} />
        <ChecklistSection category="admin_assisted_booking" items={checklist} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Launch recommendations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
          {recommendedNextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        {featureFlagRecommendations.recommendedChanges.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-zinc-800">Suggested flag changes</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {featureFlagRecommendations.recommendedChanges.map((change) => (
                <li key={change.flag} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <p className="font-mono text-xs font-semibold">{change.flag}</p>
                  <p className="mt-1">
                    {change.currentValue ? "ON" : "OFF"} → recommended{" "}
                    {change.recommendedValue ? "ON" : "OFF"}
                  </p>
                  <p className="mt-1 text-zinc-600">{change.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-red-100 bg-red-50/40 p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Emergency rollback (instructions)</h2>
        <p className="mt-1 text-sm text-zinc-600">Read-only guidance — no automated rollback actions.</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700">
          {EMERGENCY_ROLLBACK.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Export rollout report</h2>
        <a
          href={exportHref}
          className="mt-3 inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Download CSV
        </a>
      </section>
    </div>
  );
}
