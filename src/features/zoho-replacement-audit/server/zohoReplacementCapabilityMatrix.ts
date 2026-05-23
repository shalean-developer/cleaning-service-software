import "server-only";

import type { CapabilityMatrixEntry } from "./zohoReplacementAuditTypes";

type CapabilityDef = {
  key: string;
  label: string;
  category: string;
  shaleanProvides: boolean;
  zohoProvides: boolean;
  notes: string;
};

const CAPABILITY_DEFINITIONS: CapabilityDef[] = [
  {
    key: "invoices",
    label: "Invoice authority & numbering",
    category: "invoicing",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Zoho Books owns invoice numbers; Shalean mirrors checkout and sync.",
  },
  {
    key: "recurring_invoices",
    label: "Recurring invoices",
    category: "invoicing",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Recurring billing remains in Zoho; Shalean handles booking series only.",
  },
  {
    key: "customer_statements",
    label: "Corporate customer statements",
    category: "reporting",
    shaleanProvides: true,
    zohoProvides: true,
    notes: "Shalean read-only statements from local records; Zoho ledger is authoritative.",
  },
  {
    key: "tax_vat",
    label: "Tax / VAT support",
    category: "tax",
    shaleanProvides: true,
    zohoProvides: true,
    notes: "Shalean operational VAT estimates; Zoho Books for accounting-grade tax.",
  },
  {
    key: "credit_notes",
    label: "Credit notes",
    category: "refunds",
    shaleanProvides: true,
    zohoProvides: true,
    notes: "Shalean tracks refund/credit sync; Zoho issues credit notes.",
  },
  {
    key: "refunds",
    label: "Refund processing",
    category: "refunds",
    shaleanProvides: true,
    zohoProvides: true,
    notes: "Paystack refunds in Shalean; Zoho credit note sync for accounting.",
  },
  {
    key: "accounting_exports",
    label: "Accounting exports",
    category: "reporting",
    shaleanProvides: true,
    zohoProvides: true,
    notes: "Shalean CSV exports for close/tax; Zoho Books export for accountants.",
  },
  {
    key: "audit_trails",
    label: "Finance audit trails",
    category: "audit",
    shaleanProvides: true,
    zohoProvides: true,
    notes: "Shalean payment/sync logs; Zoho Books audit for ledger changes.",
  },
  {
    key: "finance_reconciliation",
    label: "Cross-system reconciliation",
    category: "operations",
    shaleanProvides: true,
    zohoProvides: false,
    notes: "Shalean-native reconciliation across Paystack and Zoho sync tables.",
  },
  {
    key: "operational_reporting",
    label: "Executive finance reporting",
    category: "reporting",
    shaleanProvides: true,
    zohoProvides: true,
    notes: "Shalean finance analytics; Zoho P&L and balance sheet.",
  },
  {
    key: "payout_tracking",
    label: "Cleaner payout tracking",
    category: "operations",
    shaleanProvides: true,
    zohoProvides: false,
    notes: "Shalean earning_lines and payout batches; not in Zoho.",
  },
  {
    key: "aging_reports",
    label: "Accounts receivable aging",
    category: "reporting",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Requires general ledger and open invoice aging — Zoho only today.",
  },
  {
    key: "ledger_accounting",
    label: "General ledger / chart of accounts",
    category: "accounting",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "No Shalean-native GL; Zoho Books is system of record.",
  },
  {
    key: "partial_payments",
    label: "Partial invoice payments",
    category: "invoicing",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Shalean checkout assumes full invoice amount; partials handled in Zoho.",
  },
  {
    key: "tax_filing",
    label: "Tax filing readiness",
    category: "tax",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Shalean VAT reports are operational estimates, not SARS-ready filing.",
  },
  {
    key: "bank_reconciliation",
    label: "Bank reconciliation",
    category: "accounting",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "No bank feed reconciliation in Shalean.",
  },
  {
    key: "double_entry",
    label: "Double-entry accounting",
    category: "accounting",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Shalean tracks operational finance events, not journal entries.",
  },
  {
    key: "invoice_numbering",
    label: "Invoice sequencing governance",
    category: "invoicing",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Sequential invoice numbers issued by Zoho Books.",
  },
  {
    key: "immutable_close",
    label: "Immutable accounting close",
    category: "accounting",
    shaleanProvides: false,
    zohoProvides: true,
    notes: "Shalean close is read-only summary; no locked accounting periods yet.",
  },
];

function resolveSupportLevel(def: CapabilityDef): CapabilityMatrixEntry["supportLevel"] {
  if (def.zohoProvides && !def.shaleanProvides) return "external_dependency";
  if (def.shaleanProvides && def.zohoProvides) return "partially_supported";
  if (def.shaleanProvides && !def.zohoProvides) return "fully_supported";
  return "missing";
}

export function buildCapabilityMatrix(): CapabilityMatrixEntry[] {
  return CAPABILITY_DEFINITIONS.map((def) => ({
    key: def.key,
    label: def.label,
    category: def.category,
    supportLevel: resolveSupportLevel(def),
    zohoProvides: def.zohoProvides,
    shaleanProvides: def.shaleanProvides,
    notes: def.notes,
  }));
}

export function evaluateShaleanCapabilities(): {
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
} {
  return {
    bookingPayments: true,
    savedMethods: true,
    adminCharges: true,
    reconciliation: true,
    accountingClose: true,
    taxReports: true,
    corporateStatements: true,
    financeAnalytics: true,
    payoutTracking: true,
    auditLogs: true,
  };
}

export function evaluateZohoDependencies(zohoConfigured: boolean): {
  invoices: boolean;
  customerPayments: boolean;
  creditNotes: boolean;
  taxSupport: boolean;
  customerStatements: boolean;
  accountingExports: boolean;
  reconciliationSupport: boolean;
} {
  return {
    invoices: zohoConfigured,
    customerPayments: zohoConfigured,
    creditNotes: zohoConfigured,
    taxSupport: zohoConfigured,
    customerStatements: zohoConfigured,
    accountingExports: zohoConfigured,
    reconciliationSupport: zohoConfigured,
  };
}

/** @internal exported for tests */
export { CAPABILITY_DEFINITIONS, resolveSupportLevel };
