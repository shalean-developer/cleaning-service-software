import "server-only";

export type CapabilitySupportLevel =
  | "fully_supported"
  | "partially_supported"
  | "missing"
  | "external_dependency";

export type CapabilitySeverity = "low" | "medium" | "high" | "critical";

export type RecommendedDecision =
  | "keep_zoho"
  | "hybrid"
  | "partial_migration_possible"
  | "full_replacement_not_ready";

export type MigrationComplexity = "low" | "medium" | "high" | "very_high";

export type MigrationPhaseReadiness = "ready" | "partial" | "not_ready";

export type ZohoReplacementAuditSummary = {
  overallReadinessScore: number;
  recommendedDecision: RecommendedDecision;
  criticalMissingCapabilities: string[];
  highRiskAreas: string[];
  estimatedMigrationComplexity: MigrationComplexity;
};

export type ZohoReplacementCurrentDependencies = {
  invoices: boolean;
  customerPayments: boolean;
  creditNotes: boolean;
  taxSupport: boolean;
  customerStatements: boolean;
  accountingExports: boolean;
  reconciliationSupport: boolean;
};

export type ShaleanNativeCapabilities = {
  bookingPayments: boolean;
  savedMethods: boolean;
  adminCharges: boolean;
  reconciliation: boolean;
  accountingClose: boolean;
  taxReports: boolean;
  corporateStatements: boolean;
  financeAnalytics: boolean;
  payoutTracking: boolean;
  auditLogs: boolean;
};

export type MissingCapability = {
  key: string;
  label: string;
  severity: CapabilitySeverity;
  description: string;
};

export type MigrationRisk = {
  key: string;
  label: string;
  severity: CapabilitySeverity;
  impact: string;
  mitigation: string;
};

export type SuggestedMigrationPhase = {
  phase: number;
  title: string;
  description: string;
  readiness: MigrationPhaseReadiness;
};

export type CapabilityMatrixEntry = {
  key: string;
  label: string;
  category: string;
  supportLevel: CapabilitySupportLevel;
  zohoProvides: boolean;
  shaleanProvides: boolean;
  notes: string;
};

export type ZohoReplacementAudit = {
  summary: ZohoReplacementAuditSummary;
  currentZohoDependencies: ZohoReplacementCurrentDependencies;
  shaleanCapabilities: ShaleanNativeCapabilities;
  capabilityMatrix: CapabilityMatrixEntry[];
  missingCapabilities: MissingCapability[];
  migrationRisks: MigrationRisk[];
  suggestedMigrationPhases: SuggestedMigrationPhase[];
  recommendedArchitecture: string[];
};

export type ZohoReplacementAuditResult = {
  audit: ZohoReplacementAudit;
};
