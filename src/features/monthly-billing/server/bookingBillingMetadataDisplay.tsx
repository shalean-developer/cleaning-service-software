import type { Json } from "@/lib/database/types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatAdminWizardBillingModeLabel } from "@/features/admin-booking-wizard/adminBillingMode";
import type { AdminWizardBillingMode } from "@/features/admin-booking-wizard/adminBillingMode";
import {
  parseMonthlyAccountBillingMetadata,
  type MonthlyAccountBillingMetadata,
} from "@/features/bookings/server/admin/monthlyAccountBookingMetadata";

export type BookingBillingMetadata =
  | MonthlyAccountBillingMetadata
  | { mode: AdminWizardBillingMode | string };

function isMonthlyAccountBillingMetadataValue(
  billing: BookingBillingMetadata,
): billing is MonthlyAccountBillingMetadata {
  return billing.mode === "monthly_account";
}

export function parseBookingBillingMetadata(metadata: Json): BookingBillingMetadata | null {
  const monthly = parseMonthlyAccountBillingMetadata(metadata);
  if (monthly) return monthly;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const billing = (metadata as Record<string, unknown>).billing;
  if (!billing || typeof billing !== "object" || Array.isArray(billing)) {
    return null;
  }

  const record = billing as Record<string, unknown>;
  const mode = typeof record.mode === "string" ? record.mode : undefined;

  if (!mode) return null;

  return { mode };
}

export function isMonthlyAccountBillingMetadata(metadata: Json): boolean {
  return parseMonthlyAccountBillingMetadata(metadata) != null;
}

function formatBillingModeLabel(mode: string | undefined): string {
  if (!mode) return "Unknown";
  if (mode === "paystack_link" || mode === "offline_payment" || mode === "monthly_account") {
    return formatAdminWizardBillingModeLabel(mode);
  }
  return mode.replace(/_/g, " ");
}

type Props = {
  metadata: Json;
};

export function AdminBookingBillingBadge({ metadata }: Props) {
  const billing = parseBookingBillingMetadata(metadata);
  if (!billing) return null;

  const isMonthlyAccount = isMonthlyAccountBillingMetadataValue(billing);
  const monthlyBilling = isMonthlyAccount ? billing : null;

  return (
    <div
      className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
      data-testid="admin-booking-billing-badge"
    >
      <div className="flex flex-wrap items-center gap-2">
        {billing.mode ? (
          <StatusBadge
            label={`Billing: ${formatBillingModeLabel(billing.mode)}`}
            tone={isMonthlyAccount ? "warning" : "neutral"}
          />
        ) : null}
        {monthlyBilling?.serviceAuthorization?.authorized ? (
          <StatusBadge label="Service authorized" tone="success" />
        ) : null}
        {monthlyBilling?.monthlyAccountId ? (
          <span className="font-mono text-xs text-zinc-600">
            Account {monthlyBilling.monthlyAccountId.slice(0, 8)}…
          </span>
        ) : null}
        {monthlyBilling?.invoiceBatchId ? (
          <span className="font-mono text-xs text-zinc-600">
            Batch {monthlyBilling.invoiceBatchId.slice(0, 8)}…
          </span>
        ) : null}
      </div>

      {monthlyBilling ? (
        <div className="space-y-1 text-xs text-slate-700">
          {monthlyBilling.zohoCustomerId ? (
            <p>
              <span className="font-medium text-slate-800">Zoho customer:</span>{" "}
              <span className="font-mono">{monthlyBilling.zohoCustomerId}</span>
            </p>
          ) : null}
          {monthlyBilling.billingEmail ? (
            <p>
              <span className="font-medium text-slate-800">Billing email:</span> {monthlyBilling.billingEmail}
            </p>
          ) : null}
          {monthlyBilling.billingTerms ? (
            <p className="whitespace-pre-wrap">
              <span className="font-medium text-slate-800">Billing terms:</span> {monthlyBilling.billingTerms}
            </p>
          ) : null}
          {monthlyBilling.serviceAuthorization?.authorized ? (
            <div
              className="space-y-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-950"
              data-testid="admin-booking-service-authorized-badge"
            >
              <p className="font-medium">Service authorized</p>
              <p>
                Authorized{" "}
                {new Date(monthlyBilling.serviceAuthorization.authorizedAt).toLocaleString("en-ZA")}
              </p>
              <p className="whitespace-pre-wrap">Reason: {monthlyBilling.serviceAuthorization.reason}</p>
              <p>Not invoiced yet</p>
            </div>
          ) : (
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-950">
              Awaiting service authorization — this is not payment confirmation.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
