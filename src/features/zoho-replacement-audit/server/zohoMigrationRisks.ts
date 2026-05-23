import "server-only";

import type { MigrationRisk } from "./zohoReplacementAuditTypes";

export const ZOHO_MIGRATION_RISKS: MigrationRisk[] = [
  {
    key: "accounting_inconsistency",
    label: "Accounting inconsistency",
    severity: "critical",
    impact:
      "Removing Zoho before a native GL exists could produce books that do not reconcile with historical Zoho records.",
    mitigation:
      "Keep Zoho as accounting authority until immutable Shalean ledger and accountant sign-off exist.",
  },
  {
    key: "tax_reporting_risk",
    label: "Tax reporting risk",
    severity: "critical",
    impact:
      "Operational VAT estimates are not filing-grade. Premature Zoho removal risks non-compliant tax reporting.",
    mitigation:
      "Retain Zoho for tax/accountant workflows until SARS-ready exports are validated by a qualified accountant.",
  },
  {
    key: "duplicate_invoice",
    label: "Duplicate invoice numbering",
    severity: "high",
    impact:
      "Parallel invoice authorities (Zoho + Shalean) could issue conflicting invoice numbers.",
    mitigation:
      "Maintain single invoice numbering authority until migration cutover with explicit sequencing governance.",
  },
  {
    key: "reconciliation_drift",
    label: "Reconciliation drift",
    severity: "high",
    impact:
      "Sales/refund sync bridges Shalean and Zoho. Removing Zoho breaks cross-system reconciliation assumptions.",
    mitigation:
      "Complete native ledger first; run parallel reconciliation during hybrid period.",
  },
  {
    key: "audit_trail_gaps",
    label: "Audit trail incompleteness",
    severity: "high",
    impact:
      "Shalean audit logs cover payments and sync; they do not replace Zoho Books ledger audit for accounting changes.",
    mitigation:
      "Preserve Zoho audit history; export before any migration. Build immutable Shalean audit for new ledger.",
  },
  {
    key: "refund_credit_mismatch",
    label: "Refund / credit note mismatch",
    severity: "high",
    impact:
      "Refunds flow through Paystack and Zoho credit notes. Native-only refunds without credit note parity breaks corporate statements.",
    mitigation:
      "Implement native credit note ledger with Paystack refund linkage before disabling Zoho refund sync.",
  },
  {
    key: "payout_divergence",
    label: "Payout / accounting divergence",
    severity: "medium",
    impact:
      "Cleaner payouts are Shalean-native and not mirrored in Zoho. A new GL must map payout expenses correctly.",
    mitigation:
      "Define COA mapping for payout expenses before replacing Zoho expense recognition.",
  },
  {
    key: "corporate_statement_mismatch",
    label: "Corporate statement mismatch",
    severity: "high",
    impact:
      "Corporate statements use Shalean records but opening balances depend on Zoho ledger completeness.",
    mitigation:
      "Do not claim full ledger parity in statements until native GL includes pre-migration balances.",
  },
  {
    key: "data_migration_loss",
    label: "Historical data migration loss",
    severity: "medium",
    impact:
      "Migrating years of Zoho invoices, payments, and credit notes without data loss is complex.",
    mitigation:
      "Plan read-only Zoho archive; migrate incrementally with accountant validation.",
  },
  {
    key: "operational_regression",
    label: "Payment flow regression",
    severity: "high",
    impact:
      "Invoice checkout, saved methods, and admin charges depend on Zoho invoice IDs today.",
    mitigation:
      "Phase migration: presentation layer first, authority last. Never remove Zoho from payment init without replacement IDs.",
  },
];

export function getMigrationRisks(): MigrationRisk[] {
  return [...ZOHO_MIGRATION_RISKS];
}

export function getHighRiskLabels(): string[] {
  return ZOHO_MIGRATION_RISKS.filter(
    (r) => r.severity === "critical" || r.severity === "high",
  ).map((r) => r.label);
}
