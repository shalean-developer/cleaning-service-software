import "server-only";

import type { AdminWizardBillingMode } from "@/features/admin-booking-wizard/adminBillingMode";
import { getCustomerBillingAccount } from "@/features/monthly-billing/server/customerBillingAccountRepository";
import { isZohoMonthlyAccountBillingEnabled } from "@/lib/app/zohoMonthlyAccountBillingFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

export type AdminWizardBillingInput = {
  mode: AdminWizardBillingMode;
  monthlyAccountId?: string;
  zohoCustomerId?: string;
  billingEmail?: string;
  billingTerms?: string;
};

export type AdminWizardBillingMetadata = {
  mode: AdminWizardBillingMode;
  monthlyAccountId?: string;
  zohoCustomerId?: string;
  billingEmail?: string;
  billingTerms?: string;
  source: "admin_wizard";
  configuredByAdminProfileId: string;
  configuredAt: string;
};

export type ValidateAdminWizardBillingModeResult =
  | { ok: true; billing: AdminWizardBillingMetadata }
  | { ok: false; message: string };

export async function validateAdminWizardBillingMode(input: {
  customerId: string;
  adminProfileId: string;
  billing: AdminWizardBillingInput;
}): Promise<ValidateAdminWizardBillingModeResult> {
  const configuredAt = new Date().toISOString();

  if (input.billing.mode === "paystack_link" || input.billing.mode === "offline_payment") {
    return {
      ok: true,
      billing: {
        mode: input.billing.mode,
        source: "admin_wizard",
        configuredByAdminProfileId: input.adminProfileId,
        configuredAt,
      },
    };
  }

  if (!isZohoMonthlyAccountBillingEnabled()) {
    return {
      ok: false,
      message: "Monthly account billing is disabled in this environment.",
    };
  }

  const monthlyAccountId = input.billing.monthlyAccountId?.trim();
  const zohoCustomerId = input.billing.zohoCustomerId?.trim();
  const billingEmail = input.billing.billingEmail?.trim();
  const billingTerms = input.billing.billingTerms?.trim();

  if (!monthlyAccountId) {
    return { ok: false, message: "monthlyAccountId is required for monthly_account billing." };
  }
  if (!zohoCustomerId) {
    return { ok: false, message: "zohoCustomerId is required for monthly_account billing." };
  }
  if (!billingEmail) {
    return { ok: false, message: "billingEmail is required for monthly_account billing." };
  }
  if (!billingTerms) {
    return { ok: false, message: "billingTerms is required for monthly_account billing." };
  }

  const client = requireServiceRoleClient();
  const account = await getCustomerBillingAccount(input.customerId, client);

  if (!account) {
    return { ok: false, message: "Customer does not have a billing account." };
  }
  if (account.id !== monthlyAccountId) {
    return { ok: false, message: "monthlyAccountId does not match the customer billing account." };
  }
  if (account.customerId !== input.customerId) {
    return { ok: false, message: "Billing account customer mismatch." };
  }
  if (!account.isMonthlyAccountEnabled) {
    return { ok: false, message: "Monthly account billing is not enabled for this customer." };
  }
  if (account.billingMode !== "monthly_account") {
    return { ok: false, message: "Customer billing mode is not monthly_account." };
  }
  if (!account.approvedAt || !account.approvedByAdminId) {
    return { ok: false, message: "Monthly account billing is not approved for this customer." };
  }
  if (!account.zohoCustomerId?.trim()) {
    return { ok: false, message: "Customer billing account is missing a Zoho customer link." };
  }
  if (account.zohoCustomerId.trim() !== zohoCustomerId) {
    return { ok: false, message: "zohoCustomerId does not match the customer billing account." };
  }
  if (!account.billingEmail?.trim() || account.billingEmail.trim() !== billingEmail) {
    return { ok: false, message: "billingEmail does not match the customer billing account." };
  }
  if (!account.billingTerms?.trim() || account.billingTerms.trim() !== billingTerms) {
    return { ok: false, message: "billingTerms does not match the customer billing account." };
  }

  return {
    ok: true,
    billing: {
      mode: "monthly_account",
      monthlyAccountId: account.id,
      zohoCustomerId: account.zohoCustomerId.trim(),
      billingEmail: account.billingEmail.trim(),
      billingTerms: account.billingTerms.trim(),
      source: "admin_wizard",
      configuredByAdminProfileId: input.adminProfileId,
      configuredAt,
    },
  };
}
