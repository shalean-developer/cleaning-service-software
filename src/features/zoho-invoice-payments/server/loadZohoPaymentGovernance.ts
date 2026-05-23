import "server-only";

import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { formatMaskedPaymentMethodDisplay } from "./zohoInvoicePaymentMethodRepository";
import { countZohoInvoicePaymentDiagnostics } from "./zohoInvoicePaymentRepository";
import { getLatestZohoInvoicePaymentCronRun } from "./zohoInvoicePaymentCronRunRepository";
import { getZohoPaymentFeatureState } from "./zohoPaymentLaunchGuard";

export type ZohoPaymentGovernanceMetrics = {
  reconcileFailedCount: number;
  reconcilePendingCount: number;
  failedAdminCardCharges: number;
  failedInvoicePayments: number;
  revokedMethodAuditCount: number;
  lastCronRun: {
    jobName: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  } | null;
  featureState: ReturnType<typeof getZohoPaymentFeatureState>;
};

export async function loadZohoPaymentGovernanceMetrics(): Promise<ZohoPaymentGovernanceMetrics> {
  const client = requireServiceRoleClient();

  const [
    paymentCounts,
    authChargeFailed,
    authChargeReconcileFailed,
    revokeAuditCount,
    lastCronRun,
  ] = await Promise.all([
    countZohoInvoicePaymentDiagnostics(client),
    client
      .from("zoho_invoice_authorization_charges")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    client
      .from("zoho_invoice_authorization_charges")
      .select("id", { count: "exact", head: true })
      .eq("status", "zoho_reconcile_failed"),
    client
      .from("zoho_invoice_payment_method_audit")
      .select("id", { count: "exact", head: true })
      .eq("action", "revoked"),
    getLatestZohoInvoicePaymentCronRun("reconcile-zoho-invoice-payments", client),
  ]);

  const failedAdminCardCharges =
    (authChargeFailed.count ?? 0) + (authChargeReconcileFailed.count ?? 0);

  return {
    reconcileFailedCount: paymentCounts.zoho_reconcile_failed ?? 0,
    reconcilePendingCount: paymentCounts.zoho_reconcile_pending ?? 0,
    failedAdminCardCharges,
    failedInvoicePayments: paymentCounts.failed ?? 0,
    revokedMethodAuditCount: revokeAuditCount.count ?? 0,
    lastCronRun: lastCronRun
      ? {
          jobName: lastCronRun.job_name,
          status: lastCronRun.status,
          startedAt: lastCronRun.started_at,
          completedAt: lastCronRun.completed_at,
        }
      : null,
    featureState: getZohoPaymentFeatureState(),
  };
}

export type ZohoPaymentAuditExportRow = {
  recordType: string;
  invoiceNumber: string | null;
  status: string;
  amountCents: number | null;
  currency: string | null;
  createdAt: string;
  paidAt: string | null;
  initiatedByAdminId: string | null;
  action: string | null;
  reason: string | null;
  maskedCard: string | null;
  paystackReference: string | null;
};

export async function exportZohoInvoicePaymentAudit(
  limit = 500,
): Promise<{ rows: ZohoPaymentAuditExportRow[] }> {
  const client = requireServiceRoleClient();
  const safeLimit = Math.min(Math.max(limit, 1), 2000);

  const [payments, authCharges, methods, audits] = await Promise.all([
    client
      .from("zoho_invoice_payments")
      .select(
        "invoice_number, status, amount_cents, currency, created_at, paid_at, paystack_reference",
      )
      .order("created_at", { ascending: false })
      .limit(safeLimit),
    client
      .from("zoho_invoice_authorization_charges")
      .select(
        "invoice_number, status, amount_cents, currency, created_at, paid_at, initiated_by_admin_id, reason, paystack_reference, payment_method_id",
      )
      .order("created_at", { ascending: false })
      .limit(safeLimit),
    client
      .from("zoho_invoice_payment_methods")
      .select(
        "id, card_type, bank, last4, consented_at, revoked_at, source_invoice_number",
      )
      .order("consented_at", { ascending: false })
      .limit(safeLimit),
    client
      .from("zoho_invoice_payment_method_audit")
      .select("payment_method_id, action, actor_type, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(safeLimit),
  ]);

  if (payments.error) throw new Error(payments.error.message);
  if (authCharges.error) throw new Error(authCharges.error.message);
  if (methods.error) throw new Error(methods.error.message);
  if (audits.error) throw new Error(audits.error.message);

  const methodMap = new Map(
    (methods.data ?? []).map((method) => [
      method.id,
      formatMaskedPaymentMethodDisplay(method),
    ]),
  );

  const rows: ZohoPaymentAuditExportRow[] = [];

  for (const payment of payments.data ?? []) {
    rows.push({
      recordType: "invoice_payment",
      invoiceNumber: payment.invoice_number,
      status: payment.status,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      createdAt: payment.created_at,
      paidAt: payment.paid_at,
      initiatedByAdminId: null,
      action: null,
      reason: null,
      maskedCard: null,
      paystackReference: payment.paystack_reference,
    });
  }

  for (const charge of authCharges.data ?? []) {
    rows.push({
      recordType: "admin_authorization_charge",
      invoiceNumber: charge.invoice_number,
      status: charge.status,
      amountCents: charge.amount_cents,
      currency: charge.currency,
      createdAt: charge.created_at,
      paidAt: charge.paid_at,
      initiatedByAdminId: charge.initiated_by_admin_id,
      action: "charge_saved_card",
      reason: charge.reason,
      maskedCard: methodMap.get(charge.payment_method_id) ?? null,
      paystackReference: charge.paystack_reference,
    });
  }

  for (const method of methods.data ?? []) {
    rows.push({
      recordType: "saved_method_capture",
      invoiceNumber: method.source_invoice_number,
      status: method.revoked_at ? "revoked" : "active",
      amountCents: null,
      currency: null,
      createdAt: method.consented_at,
      paidAt: null,
      initiatedByAdminId: null,
      action: "saved",
      reason: null,
      maskedCard: formatMaskedPaymentMethodDisplay(method),
      paystackReference: null,
    });
  }

  for (const audit of audits.data ?? []) {
    rows.push({
      recordType: "payment_method_audit",
      invoiceNumber: null,
      status: audit.action,
      amountCents: null,
      currency: null,
      createdAt: audit.created_at,
      paidAt: null,
      initiatedByAdminId: audit.actor_type === "admin" ? "admin" : null,
      action: audit.action,
      reason: audit.reason,
      maskedCard: methodMap.get(audit.payment_method_id) ?? null,
      paystackReference: null,
    });
  }

  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { rows: rows.slice(0, safeLimit) };
}

export function zohoPaymentAuditRowsToCsv(rows: ZohoPaymentAuditExportRow[]): string {
  const headers = [
    "recordType",
    "invoiceNumber",
    "status",
    "amountCents",
    "currency",
    "createdAt",
    "paidAt",
    "initiatedByAdminId",
    "action",
    "reason",
    "maskedCard",
    "paystackReference",
  ];

  const escape = (value: string | number | null) => {
    if (value == null) return "";
    const text = String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.recordType,
        row.invoiceNumber,
        row.status,
        row.amountCents,
        row.currency,
        row.createdAt,
        row.paidAt,
        row.initiatedByAdminId,
        row.action,
        row.reason,
        row.maskedCard,
        row.paystackReference,
      ]
        .map(escape)
        .join(","),
    ),
  ];

  return lines.join("\n");
}
