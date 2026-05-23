import { describe, expect, it } from "vitest";
import {
  buildCapabilityMatrix,
  resolveSupportLevel,
} from "./zohoReplacementCapabilityMatrix";
import { getMissingCapabilities } from "./zohoMissingCapabilities";
import { getMigrationRisks } from "./zohoMigrationRisks";
import {
  computeWeightedReadinessScore,
  deriveMigrationComplexity,
  deriveRecommendedDecision,
} from "./zohoReplacementReadinessScore";
import { buildZohoReplacementAudit } from "./zohoReplacementAuditReadModel";

describe("zohoReplacementReadinessScore", () => {
  it("maps score thresholds to recommended decisions", () => {
    expect(deriveRecommendedDecision(20)).toBe("keep_zoho");
    expect(deriveRecommendedDecision(39)).toBe("keep_zoho");
    expect(deriveRecommendedDecision(40)).toBe("hybrid");
    expect(deriveRecommendedDecision(64)).toBe("hybrid");
    expect(deriveRecommendedDecision(65)).toBe("partial_migration_possible");
    expect(deriveRecommendedDecision(79)).toBe("partial_migration_possible");
    expect(deriveRecommendedDecision(80)).toBe("full_replacement_not_ready");
    expect(deriveRecommendedDecision(95)).toBe("full_replacement_not_ready");
  });

  it("returns bounded readiness score with missing capability penalties", () => {
    const matrix = buildCapabilityMatrix();
    const missing = getMissingCapabilities();
    const score = computeWeightedReadinessScore(matrix, missing);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeLessThan(65);
  });

  it("derives migration complexity from score and critical gaps", () => {
    expect(deriveMigrationComplexity(25, 5)).toBe("very_high");
    expect(deriveMigrationComplexity(45, 3)).toBe("high");
    expect(deriveMigrationComplexity(60, 1)).toBe("medium");
    expect(deriveMigrationComplexity(75, 0)).toBe("low");
  });
});

describe("zohoReplacementCapabilityMatrix", () => {
  it("scores capabilities with expected support levels", () => {
    const matrix = buildCapabilityMatrix();
    expect(matrix.length).toBeGreaterThanOrEqual(19);

    const invoices = matrix.find((entry) => entry.key === "invoices");
    expect(invoices?.supportLevel).toBe("external_dependency");

    const reconciliation = matrix.find((entry) => entry.key === "finance_reconciliation");
    expect(reconciliation?.supportLevel).toBe("fully_supported");

    const ledger = matrix.find((entry) => entry.key === "ledger_accounting");
    expect(ledger?.supportLevel).toBe("external_dependency");
  });

  it("resolveSupportLevel follows zoho/shalean matrix rules", () => {
    expect(
      resolveSupportLevel({
        key: "x",
        label: "x",
        category: "accounting",
        shaleanProvides: true,
        zohoProvides: false,
        notes: "",
      }),
    ).toBe("fully_supported");
    expect(
      resolveSupportLevel({
        key: "y",
        label: "y",
        category: "accounting",
        shaleanProvides: false,
        zohoProvides: true,
        notes: "",
      }),
    ).toBe("external_dependency");
  });
});

describe("zohoMissingCapabilities", () => {
  it("includes critical accounting gaps with severity", () => {
    const missing = getMissingCapabilities();
    const ledger = missing.find((item) => item.key === "immutable_ledger");
    expect(ledger?.severity).toBe("critical");
    expect(missing.some((item) => item.severity === "critical")).toBe(true);
  });
});

describe("zohoMigrationRisks", () => {
  it("maps risks with severity impact and mitigation", () => {
    const risks = getMigrationRisks();
    const taxRisk = risks.find((risk) => risk.key === "tax_reporting_risk");
    expect(taxRisk?.severity).toBe("critical");
    expect(taxRisk?.impact.length).toBeGreaterThan(0);
    expect(taxRisk?.mitigation.length).toBeGreaterThan(0);
  });
});

describe("buildZohoReplacementAudit", () => {
  it("builds complete audit with phases and architecture guidance", () => {
    const audit = buildZohoReplacementAudit(true);
    expect(audit.summary.overallReadinessScore).toBeGreaterThanOrEqual(0);
    expect(audit.capabilityMatrix.length).toBeGreaterThan(0);
    expect(audit.missingCapabilities.length).toBeGreaterThan(0);
    expect(audit.migrationRisks.length).toBeGreaterThan(0);
    expect(audit.suggestedMigrationPhases).toHaveLength(5);
    expect(audit.recommendedArchitecture.length).toBeGreaterThan(0);
    expect(audit.suggestedMigrationPhases[0].readiness).toBe("ready");
  });

  it("reflects zoho dependency flags from configuration", () => {
    const configured = buildZohoReplacementAudit(true);
    const unconfigured = buildZohoReplacementAudit(false);
    expect(configured.currentZohoDependencies.invoices).toBe(true);
    expect(unconfigured.currentZohoDependencies.invoices).toBe(false);
  });
});
