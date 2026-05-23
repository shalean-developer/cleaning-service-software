import type { AdminWizardCustomerBillingSnapshot } from "./adminBillingMode";

type CustomerBillingAccountApiPayload = {
  customerId: string;
  account: { id: string } | null;
  monthlyAccountEnabled: boolean;
  billingMode: string | null;
  zohoCustomerId: string | null;
  billingEmail: string | null;
  billingTerms: string | null;
  approvedAt: string | null;
  approvedByAdminId: string | null;
  accountStatusLabel: string;
};

export type FetchAdminCustomerBillingAccountResult =
  | { ok: true; snapshot: AdminWizardCustomerBillingSnapshot | null }
  | { ok: false; message: string };

export function mapCustomerBillingAccountApiPayloadToSnapshot(
  readModel: CustomerBillingAccountApiPayload,
): AdminWizardCustomerBillingSnapshot {
  return {
    customerId: readModel.customerId,
    accountId: readModel.account?.id ?? null,
    monthlyAccountEnabled: readModel.monthlyAccountEnabled,
    billingMode: readModel.billingMode,
    zohoCustomerId: readModel.zohoCustomerId,
    billingEmail: readModel.billingEmail,
    billingTerms: readModel.billingTerms,
    approvedAt: readModel.approvedAt,
    approvedByAdminId: readModel.approvedByAdminId,
    accountStatusLabel: readModel.accountStatusLabel,
  };
}

export async function fetchAdminCustomerBillingAccount(
  customerId: string,
): Promise<FetchAdminCustomerBillingAccountResult> {
  const trimmed = customerId.trim();
  if (!trimmed) {
    return { ok: false, message: "Customer ID is required." };
  }

  const response = await fetch(
    `/api/admin/monthly-billing/accounts/${encodeURIComponent(trimmed)}`,
  );
  const json = (await response.json()) as
    | { ok: true; account: CustomerBillingAccountApiPayload }
    | { ok: false; message?: string };

  if (!response.ok || !json.ok || !("account" in json)) {
    return {
      ok: false,
      message: "message" in json && json.message ? json.message : "Could not load billing account.",
    };
  }

  return {
    ok: true,
    snapshot: mapCustomerBillingAccountApiPayloadToSnapshot(json.account),
  };
}
