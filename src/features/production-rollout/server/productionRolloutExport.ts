import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type {
  FeatureFlagRecommendations,
  ProductionRolloutStatus,
} from "./productionRolloutTypes";

const FORBIDDEN_CSV_SUBSTRINGS = [
  "authorization_code",
  "access_code",
  "refresh_token",
  "sk_live_",
  "sk_test_",
  "PAYSTACK_SECRET",
  "ZOHO_CLIENT_SECRET",
  "@",
] as const;

function assertSafeCsv(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`Export contains forbidden field: ${forbidden}`);
    }
  }
}

export function productionRolloutChecklistToCsv(
  status: ProductionRolloutStatus,
): string {
  const headers = [
    "checklist_key",
    "label",
    "category",
    "completed",
    "completed_at",
    "notes",
  ];
  const rows = status.checklist.map((item) =>
    formatCsvRow([
      item.checklistKey,
      item.label,
      item.category,
      String(item.completed),
      item.completedAt ?? "",
      item.notes ?? "",
    ]),
  );
  const csv = [formatCsvRow(headers), ...rows].join("\n");
  assertSafeCsv(csv);
  return csv;
}

export function productionRolloutSummaryToCsv(input: {
  status: ProductionRolloutStatus;
  featureFlagRecommendations: FeatureFlagRecommendations;
}): string {
  const { status, featureFlagRecommendations } = input;
  const checklistCsv = productionRolloutChecklistToCsv(status);

  const flagRows = Object.entries(status.featureFlags).map(([flag, value]) =>
    formatCsvRow(["feature_flag", flag, String(value)]),
  );

  const readinessRows = Object.entries(status.rolloutReadiness).map(([key, value]) =>
    formatCsvRow(["readiness", key, String(value)]),
  );

  const recommendationRows = status.recommendedNextSteps.map((step) =>
    formatCsvRow(["recommendation", step]),
  );

  const warningRows = featureFlagRecommendations.warnings.map((warning) =>
    formatCsvRow(["warning", warning]),
  );

  const csv = [
    checklistCsv,
    "",
    formatCsvRow(["section", "key", "value"]),
    ...flagRows,
    ...readinessRows,
    ...recommendationRows,
    ...warningRows,
  ].join("\n");

  assertSafeCsv(csv);
  return csv;
}

export function buildProductionRolloutExportFilename(): string {
  return `production-rollout-${new Date().toISOString().slice(0, 10)}.csv`;
}
