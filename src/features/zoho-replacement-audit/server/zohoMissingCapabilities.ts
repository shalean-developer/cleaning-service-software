import "server-only";

import type { MissingCapability } from "./zohoReplacementAuditTypes";

export const ZOHO_MISSING_CAPABILITIES: MissingCapability[] = [
  {
    key: "immutable_ledger",
    label: "Immutable accounting ledger",
    severity: "critical",
    description:
      "No append-only ledger with period locks. Shalean close summaries are operational, not immutable accounting records.",
  },
  {
    key: "double_entry",
    label: "Double-entry accounting",
    severity: "critical",
    description:
      "No debit/credit journal engine. Revenue and payouts are tracked separately without balanced entries.",
  },
  {
    key: "general_ledger",
    label: "General ledger & chart of accounts",
    severity: "critical",
    description:
      "No native GL, COA, or account mapping. Zoho Books remains the accounting system of record.",
  },
  {
    key: "bank_reconciliation",
    label: "Bank reconciliation",
    severity: "critical",
    description:
      "No bank feed import or statement matching. Required for accountant-grade books.",
  },
  {
    key: "tax_filing",
    label: "Tax filing integration",
    severity: "critical",
    description:
      "VAT reports are operational estimates only — not SARS-ready filing or official tax submissions.",
  },
  {
    key: "aging_reports",
    label: "Accounts receivable aging",
    severity: "high",
    description:
      "Corporate statements show activity but not full AR aging against an authoritative ledger.",
  },
  {
    key: "journal_entries",
    label: "Manual journal entries",
    severity: "high",
    description:
      "No support for adjusting entries, accruals, or period-end journals.",
  },
  {
    key: "invoice_sequencing",
    label: "Invoice sequencing governance",
    severity: "high",
    description:
      "Invoice numbers are issued by Zoho. Replacing Zoho requires governed sequential numbering.",
  },
  {
    key: "accountant_workflows",
    label: "Accountant review workflows",
    severity: "medium",
    description:
      "No formal review/approval workflow for period close sign-off by external accountants.",
  },
  {
    key: "regulatory_exports",
    label: "Regulatory accounting exports",
    severity: "high",
    description:
      "Exports support operations, not statutory accounting formats required by auditors.",
  },
  {
    key: "partial_payments",
    label: "Partial payment allocation",
    severity: "medium",
    description:
      "Invoice checkout assumes full payment. Partial allocations require native invoice ledger.",
  },
  {
    key: "recurring_invoicing",
    label: "Native recurring invoicing",
    severity: "medium",
    description:
      "Recurring billing for corporate clients is not native — booking series differ from invoice cycles.",
  },
];

export function getMissingCapabilities(): MissingCapability[] {
  return [...ZOHO_MISSING_CAPABILITIES];
}

export function getCriticalMissingLabels(): string[] {
  return ZOHO_MISSING_CAPABILITIES.filter((c) => c.severity === "critical").map((c) => c.label);
}
