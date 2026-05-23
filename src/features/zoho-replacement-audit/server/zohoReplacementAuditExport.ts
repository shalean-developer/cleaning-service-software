import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type { ZohoReplacementAudit } from "./zohoReplacementAuditTypes";

const FORBIDDEN_EXPORT_SUBSTRINGS = [
  "authorization_code",
  "access_code",
  "refresh_token",
  "client_secret",
  "sk_live_",
  "sk_test_",
  "PAYSTACK_SECRET",
  "ZOHO_CLIENT_SECRET",
  "metadata",
  "@",
] as const;

function assertSafeExport(content: string): void {
  const lower = content.toLowerCase();
  for (const forbidden of FORBIDDEN_EXPORT_SUBSTRINGS) {
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`Export contains forbidden field: ${forbidden}`);
    }
  }
}

export function capabilityMatrixToCsv(audit: ZohoReplacementAudit): string {
  const headers = [
    "key",
    "label",
    "category",
    "support_level",
    "zoho_provides",
    "shalean_provides",
    "notes",
  ];
  const rows = audit.capabilityMatrix.map((entry) =>
    formatCsvRow([
      entry.key,
      entry.label,
      entry.category,
      entry.supportLevel,
      String(entry.zohoProvides),
      String(entry.shaleanProvides),
      entry.notes,
    ]),
  );
  return [formatCsvRow(headers), ...rows].join("\n");
}

export function missingCapabilitiesToCsv(audit: ZohoReplacementAudit): string {
  const headers = ["key", "label", "severity", "description"];
  const rows = audit.missingCapabilities.map((item) =>
    formatCsvRow([item.key, item.label, item.severity, item.description]),
  );
  return [formatCsvRow(headers), ...rows].join("\n");
}

export function migrationRisksToCsv(audit: ZohoReplacementAudit): string {
  const headers = ["key", "label", "severity", "impact", "mitigation"];
  const rows = audit.migrationRisks.map((risk) =>
    formatCsvRow([risk.key, risk.label, risk.severity, risk.impact, risk.mitigation]),
  );
  return [formatCsvRow(headers), ...rows].join("\n");
}

export function migrationPhasesToCsv(audit: ZohoReplacementAudit): string {
  const headers = ["phase", "title", "description", "readiness"];
  const rows = audit.suggestedMigrationPhases.map((phase) =>
    formatCsvRow([
      String(phase.phase),
      phase.title,
      phase.description,
      phase.readiness,
    ]),
  );
  return [formatCsvRow(headers), ...rows].join("\n");
}

export function zohoReplacementAuditToCsv(audit: ZohoReplacementAudit): string {
  const summaryRows = [
    formatCsvRow(["section", "field", "value"]),
    formatCsvRow(["summary", "overall_readiness_score", String(audit.summary.overallReadinessScore)]),
    formatCsvRow(["summary", "recommended_decision", audit.summary.recommendedDecision]),
    formatCsvRow([
      "summary",
      "estimated_migration_complexity",
      audit.summary.estimatedMigrationComplexity,
    ]),
    formatCsvRow([
      "summary",
      "critical_missing_capabilities",
      audit.summary.criticalMissingCapabilities.join("; "),
    ]),
    formatCsvRow(["summary", "high_risk_areas", audit.summary.highRiskAreas.join("; ")]),
    "",
    "## capability_matrix",
    capabilityMatrixToCsv(audit),
    "",
    "## missing_capabilities",
    missingCapabilitiesToCsv(audit),
    "",
    "## migration_risks",
    migrationRisksToCsv(audit),
    "",
    "## migration_phases",
    migrationPhasesToCsv(audit),
  ];

  const csv = summaryRows.join("\n");
  assertSafeExport(csv);
  return csv;
}

export function zohoReplacementAuditToMarkdown(audit: ZohoReplacementAudit): string {
  const lines = [
    "# Zoho Replacement Feasibility Audit",
    "",
    "> Zoho replacement should be reviewed with an accountant before implementation.",
    "",
    "## Executive summary",
    "",
    `- **Readiness score:** ${audit.summary.overallReadinessScore}/100`,
    `- **Recommended decision:** ${audit.summary.recommendedDecision}`,
    `- **Migration complexity:** ${audit.summary.estimatedMigrationComplexity}`,
    "",
    "### Critical missing capabilities",
    ...audit.summary.criticalMissingCapabilities.map((item) => `- ${item}`),
    "",
    "### High risk areas",
    ...audit.summary.highRiskAreas.map((item) => `- ${item}`),
    "",
    "## Recommended architecture",
    ...audit.recommendedArchitecture.map((item) => `- ${item}`),
    "",
    "## Suggested migration phases",
    ...audit.suggestedMigrationPhases.map(
      (phase) =>
        `### ${phase.title}\n\n${phase.description}\n\n**Readiness:** ${phase.readiness}`,
    ),
    "",
    "## Missing capabilities",
    ...audit.missingCapabilities.map(
      (item) => `- **${item.label}** (${item.severity}): ${item.description}`,
    ),
    "",
    "## Migration risks",
    ...audit.migrationRisks.map(
      (risk) =>
        `- **${risk.label}** (${risk.severity}): ${risk.impact} Mitigation: ${risk.mitigation}`,
    ),
  ];

  const markdown = lines.join("\n");
  assertSafeExport(markdown);
  return markdown;
}

export function zohoReplacementAuditToJson(audit: ZohoReplacementAudit): string {
  const json = JSON.stringify({ ok: true, audit }, null, 2);
  assertSafeExport(json);
  return json;
}

export function buildZohoReplacementAuditExportFilename(format: string): string {
  const ts = new Date().toISOString().slice(0, 10);
  const ext = format === "markdown" || format === "md" ? "md" : format === "json" ? "json" : "csv";
  return `zoho-replacement-audit-${ts}.${ext}`;
}

export type ZohoReplacementAuditExportFormat = "csv" | "json" | "markdown" | "md";

export function zohoReplacementAuditToExport(
  audit: ZohoReplacementAudit,
  format: ZohoReplacementAuditExportFormat,
): { body: string; contentType: string } {
  switch (format) {
    case "json":
      return {
        body: zohoReplacementAuditToJson(audit),
        contentType: "application/json; charset=utf-8",
      };
    case "markdown":
    case "md":
      return {
        body: zohoReplacementAuditToMarkdown(audit),
        contentType: "text/markdown; charset=utf-8",
      };
    case "csv":
    default:
      return {
        body: zohoReplacementAuditToCsv(audit),
        contentType: "text/csv; charset=utf-8",
      };
  }
}
