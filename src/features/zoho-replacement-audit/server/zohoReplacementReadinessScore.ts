import "server-only";

import type {
  CapabilityMatrixEntry,
  CapabilitySupportLevel,
  MigrationComplexity,
  MissingCapability,
  RecommendedDecision,
} from "./zohoReplacementAuditTypes";

const SUPPORT_SCORES: Record<CapabilitySupportLevel, number> = {
  fully_supported: 100,
  partially_supported: 55,
  missing: 0,
  external_dependency: 15,
};

const CATEGORY_WEIGHTS: Record<string, number> = {
  accounting: 1.5,
  tax: 1.4,
  audit: 1.3,
  invoicing: 1.2,
  refunds: 1.1,
  operations: 1.0,
  reporting: 0.8,
};

const SEVERITY_PENALTIES: Record<MissingCapability["severity"], number> = {
  critical: 12,
  high: 6,
  medium: 3,
  low: 1,
};

export function scoreCapabilityEntry(entry: CapabilityMatrixEntry): number {
  const base = SUPPORT_SCORES[entry.supportLevel];
  const weight = CATEGORY_WEIGHTS[entry.category] ?? 1;
  return base * weight;
}

export function computeWeightedReadinessScore(
  matrix: CapabilityMatrixEntry[],
  missingCapabilities: MissingCapability[],
): number {
  if (matrix.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const entry of matrix) {
    const weight = CATEGORY_WEIGHTS[entry.category] ?? 1;
    weightedSum += scoreCapabilityEntry(entry) * weight;
    totalWeight += 100 * weight;
  }

  let score = totalWeight > 0 ? (weightedSum / totalWeight) * 100 : 0;

  for (const missing of missingCapabilities) {
    score -= SEVERITY_PENALTIES[missing.severity];
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveRecommendedDecision(score: number): RecommendedDecision {
  if (score < 40) return "keep_zoho";
  if (score < 65) return "hybrid";
  if (score < 80) return "partial_migration_possible";
  return "full_replacement_not_ready";
}

export function deriveMigrationComplexity(
  score: number,
  criticalMissingCount: number,
): MigrationComplexity {
  if (criticalMissingCount >= 4 || score < 30) return "very_high";
  if (criticalMissingCount >= 2 || score < 50) return "high";
  if (score < 70) return "medium";
  return "low";
}

export function buildSuggestedMigrationPhases(score: number): Array<{
  phase: number;
  title: string;
  description: string;
  readiness: "ready" | "partial" | "not_ready";
}> {
  return [
    {
      phase: 1,
      title: "Phase A — Keep Zoho as accounting authority",
      description:
        "Continue Zoho Books for GL, tax, invoice numbering, and accountant workflows. Shalean handles operations.",
      readiness: "ready",
    },
    {
      phase: 2,
      title: "Phase B — Shalean invoice presentation layer",
      description:
        "Expose customer-facing invoice views in Shalean while Zoho remains numbering and ledger authority.",
      readiness: score >= 45 ? "partial" : "not_ready",
    },
    {
      phase: 3,
      title: "Phase C — Native immutable invoice ledger",
      description:
        "Build append-only invoice ledger in Shalean with governed sequencing; run parallel to Zoho.",
      readiness: score >= 55 ? "partial" : "not_ready",
    },
    {
      phase: 4,
      title: "Phase D — Double-entry accounting engine",
      description:
        "Add GL, COA, journal entries, bank reconciliation, and period locks.",
      readiness: score >= 70 ? "partial" : "not_ready",
    },
    {
      phase: 5,
      title: "Phase E — Accountant-reviewed Zoho replacement",
      description:
        "Replace Zoho only after external accountant validates migrated books and tax readiness.",
      readiness: score >= 80 ? "partial" : "not_ready",
    },
  ];
}

export function buildRecommendedArchitecture(): string[] {
  return [
    "Hybrid model recommended: Shalean owns operational finance (payments, reconciliation, payouts, analytics).",
    "Zoho Books remains accounting authority until native GL, double-entry, and tax filing are validated.",
    "Maintain single invoice numbering authority — never dual-issue invoice numbers.",
    "Run parallel reconciliation during any migration window.",
    "Preserve Zoho as read-only archive after cutover for audit history.",
    "All replacement decisions require qualified accountant review before implementation.",
  ];
}
