import Link from "next/link";
import type {
  CapabilityMatrixEntry,
  CapabilitySupportLevel,
  MigrationRisk,
  MissingCapability,
  RecommendedDecision,
  SuggestedMigrationPhase,
  ZohoReplacementAudit,
} from "@/features/zoho-replacement-audit/server/zohoReplacementAuditTypes";

type Props = {
  audit: ZohoReplacementAudit;
};

const AUDIT_DISCLAIMER =
  "Zoho replacement should be reviewed with an accountant before implementation. This audit is read-only diagnostics and planning — it does not change payment flows or remove Zoho.";

const DECISION_LABELS: Record<RecommendedDecision, string> = {
  keep_zoho: "Keep Zoho as accounting authority",
  hybrid: "Hybrid model recommended",
  partial_migration_possible: "Partial migration possible",
  full_replacement_not_ready: "Replacement feasible with accountant review",
};

const SUPPORT_LABELS: Record<CapabilitySupportLevel, string> = {
  fully_supported: "Fully supported",
  partially_supported: "Partially supported",
  missing: "Missing",
  external_dependency: "External dependency (Zoho)",
};

function supportBadgeClass(level: CapabilitySupportLevel): string {
  switch (level) {
    case "fully_supported":
      return "bg-emerald-50 text-emerald-800";
    case "partially_supported":
      return "bg-sky-50 text-sky-800";
    case "missing":
      return "bg-red-50 text-red-800";
    case "external_dependency":
      return "bg-amber-50 text-amber-900";
  }
}

function severityBadgeClass(severity: MissingCapability["severity"]): string {
  switch (severity) {
    case "critical":
      return "bg-red-50 text-red-800";
    case "high":
      return "bg-orange-50 text-orange-900";
    case "medium":
      return "bg-amber-50 text-amber-900";
    case "low":
      return "bg-zinc-100 text-zinc-700";
  }
}

function readinessBadgeClass(readiness: SuggestedMigrationPhase["readiness"]): string {
  switch (readiness) {
    case "ready":
      return "bg-emerald-50 text-emerald-800";
    case "partial":
      return "bg-amber-50 text-amber-900";
    case "not_ready":
      return "bg-zinc-100 text-zinc-700";
  }
}

function BoolIndicator({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        enabled ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {label}: {enabled ? "Yes" : "No"}
    </span>
  );
}

function CapabilityMatrixTable({ entries }: { entries: CapabilityMatrixEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Capability</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Category</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Support</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Zoho</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Shalean</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {entries.map((entry) => (
            <tr key={entry.key}>
              <td className="px-3 py-2 font-medium text-zinc-900">{entry.label}</td>
              <td className="px-3 py-2 text-zinc-600">{entry.category}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${supportBadgeClass(entry.supportLevel)}`}
                >
                  {SUPPORT_LABELS[entry.supportLevel]}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-600">{entry.zohoProvides ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-zinc-600">{entry.shaleanProvides ? "Yes" : "No"}</td>
              <td className="px-3 py-2 text-zinc-600">{entry.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingCapabilitiesTable({ items }: { items: MissingCapability[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Capability</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Severity</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {items.map((item) => (
            <tr key={item.key}>
              <td className="px-3 py-2 font-medium text-zinc-900">{item.label}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${severityBadgeClass(item.severity)}`}
                >
                  {item.severity}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-600">{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MigrationRisksTable({ risks }: { risks: MigrationRisk[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Risk</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Severity</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Impact</th>
            <th className="px-3 py-2 text-left font-medium text-zinc-600">Mitigation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {risks.map((risk) => (
            <tr key={risk.key}>
              <td className="px-3 py-2 font-medium text-zinc-900">{risk.label}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${severityBadgeClass(risk.severity)}`}
                >
                  {risk.severity}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-600">{risk.impact}</td>
              <td className="px-3 py-2 text-zinc-600">{risk.mitigation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminZohoReplacementAuditDashboard({ audit }: Props) {
  const { summary } = audit;
  const exportCsvHref = "/api/admin/finance/zoho-replacement-audit/export?format=csv";
  const exportJsonHref = "/api/admin/finance/zoho-replacement-audit/export?format=json";
  const exportMarkdownHref =
    "/api/admin/finance/zoho-replacement-audit/export?format=markdown";

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {AUDIT_DISCLAIMER}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Executive summary</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Migration readiness score
            </p>
            <p className="mt-1 text-3xl font-bold text-zinc-900">
              {summary.overallReadinessScore}
              <span className="text-lg font-normal text-zinc-500">/100</span>
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Recommended decision
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-900">
              {DECISION_LABELS[summary.recommendedDecision]}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Migration complexity
            </p>
            <p className="mt-1 text-sm font-semibold capitalize text-zinc-900">
              {summary.estimatedMigrationComplexity.replace("_", " ")}
            </p>
          </div>
        </div>
        {summary.criticalMissingCapabilities.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-zinc-900">Critical gaps</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
              {summary.criticalMissingCapabilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Current Zoho dependencies</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <BoolIndicator enabled={audit.currentZohoDependencies.invoices} label="Invoices" />
          <BoolIndicator
            enabled={audit.currentZohoDependencies.customerPayments}
            label="Customer payments"
          />
          <BoolIndicator enabled={audit.currentZohoDependencies.creditNotes} label="Credit notes" />
          <BoolIndicator enabled={audit.currentZohoDependencies.taxSupport} label="Tax support" />
          <BoolIndicator
            enabled={audit.currentZohoDependencies.customerStatements}
            label="Customer statements"
          />
          <BoolIndicator
            enabled={audit.currentZohoDependencies.accountingExports}
            label="Accounting exports"
          />
          <BoolIndicator
            enabled={audit.currentZohoDependencies.reconciliationSupport}
            label="Reconciliation support"
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Shalean-native capabilities</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <BoolIndicator enabled={audit.shaleanCapabilities.bookingPayments} label="Booking payments" />
          <BoolIndicator enabled={audit.shaleanCapabilities.savedMethods} label="Saved methods" />
          <BoolIndicator enabled={audit.shaleanCapabilities.adminCharges} label="Admin charges" />
          <BoolIndicator enabled={audit.shaleanCapabilities.reconciliation} label="Reconciliation" />
          <BoolIndicator enabled={audit.shaleanCapabilities.accountingClose} label="Accounting close" />
          <BoolIndicator enabled={audit.shaleanCapabilities.taxReports} label="Tax reports" />
          <BoolIndicator
            enabled={audit.shaleanCapabilities.corporateStatements}
            label="Corporate statements"
          />
          <BoolIndicator
            enabled={audit.shaleanCapabilities.financeAnalytics}
            label="Finance analytics"
          />
          <BoolIndicator enabled={audit.shaleanCapabilities.payoutTracking} label="Payout tracking" />
          <BoolIndicator enabled={audit.shaleanCapabilities.auditLogs} label="Audit logs" />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Capability matrix</h2>
        <div className="mt-3">
          <CapabilityMatrixTable entries={audit.capabilityMatrix} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Missing accounting capabilities</h2>
        <div className="mt-3">
          <MissingCapabilitiesTable items={audit.missingCapabilities} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Risk assessment</h2>
        <div className="mt-3">
          <MigrationRisksTable risks={audit.migrationRisks} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Suggested phased migration plan</h2>
        <ol className="mt-4 space-y-4">
          {audit.suggestedMigrationPhases.map((phase) => (
            <li key={phase.phase} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-900">{phase.title}</h3>
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${readinessBadgeClass(phase.readiness)}`}
                >
                  {phase.readiness.replace("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{phase.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Recommended architecture</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
          {audit.recommendedArchitecture.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">Export / report</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Download read-only audit reports for leadership and accountant review.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href={exportCsvHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Download CSV
          </Link>
          <Link
            href={exportJsonHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Download JSON
          </Link>
          <Link
            href={exportMarkdownHref}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Download Markdown report
          </Link>
        </div>
      </section>
    </div>
  );
}


