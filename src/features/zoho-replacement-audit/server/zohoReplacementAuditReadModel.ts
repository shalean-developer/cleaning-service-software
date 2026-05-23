import "server-only";

import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";
import { getCriticalMissingLabels, getMissingCapabilities } from "./zohoMissingCapabilities";
import { getHighRiskLabels, getMigrationRisks } from "./zohoMigrationRisks";
import { logZohoReplacementAuditEvent } from "./zohoReplacementAuditLogger";
import type { ZohoReplacementAudit, ZohoReplacementAuditResult } from "./zohoReplacementAuditTypes";
import {
  buildCapabilityMatrix,
  evaluateShaleanCapabilities,
  evaluateZohoDependencies,
} from "./zohoReplacementCapabilityMatrix";
import {
  buildRecommendedArchitecture,
  buildSuggestedMigrationPhases,
  computeWeightedReadinessScore,
  deriveMigrationComplexity,
  deriveRecommendedDecision,
} from "./zohoReplacementReadinessScore";

export function buildZohoReplacementAudit(zohoConfigured: boolean): ZohoReplacementAudit {
  const capabilityMatrix = buildCapabilityMatrix();
  const missingCapabilities = getMissingCapabilities();
  const migrationRisks = getMigrationRisks();

  const overallReadinessScore = computeWeightedReadinessScore(
    capabilityMatrix,
    missingCapabilities,
  );
  const criticalMissingCount = missingCapabilities.filter(
    (c) => c.severity === "critical",
  ).length;

  const summary = {
    overallReadinessScore,
    recommendedDecision: deriveRecommendedDecision(overallReadinessScore),
    criticalMissingCapabilities: getCriticalMissingLabels(),
    highRiskAreas: getHighRiskLabels(),
    estimatedMigrationComplexity: deriveMigrationComplexity(
      overallReadinessScore,
      criticalMissingCount,
    ),
  };

  return {
    summary,
    currentZohoDependencies: evaluateZohoDependencies(zohoConfigured),
    shaleanCapabilities: evaluateShaleanCapabilities(),
    capabilityMatrix,
    missingCapabilities,
    migrationRisks,
    suggestedMigrationPhases: buildSuggestedMigrationPhases(overallReadinessScore),
    recommendedArchitecture: buildRecommendedArchitecture(),
  };
}

export async function loadZohoReplacementAudit(): Promise<ZohoReplacementAuditResult> {
  try {
    const zohoConfigured = isZohoBooksEnabled();
    const audit = buildZohoReplacementAudit(zohoConfigured);

    logZohoReplacementAuditEvent("zoho_replacement_audit_loaded", {
      overallReadinessScore: audit.summary.overallReadinessScore,
      recommendedDecision: audit.summary.recommendedDecision,
      zohoConfigured,
      criticalMissingCount: audit.missingCapabilities.filter((c) => c.severity === "critical")
        .length,
    });

    return { audit };
  } catch {
    logZohoReplacementAuditEvent("zoho_replacement_audit_failed", { stage: "load" });
    throw new Error("Could not load Zoho replacement audit.");
  }
}

export async function loadZohoReplacementAuditForExport(): Promise<ZohoReplacementAuditResult> {
  return loadZohoReplacementAudit();
}
