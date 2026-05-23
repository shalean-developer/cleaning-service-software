export const ADMIN_WIZARD_BILLING_MODES = [
  "paystack_link",
  "offline_payment",
  "monthly_account",
] as const;

export type AdminWizardBillingMode = (typeof ADMIN_WIZARD_BILLING_MODES)[number];

export const DEFAULT_ADMIN_WIZARD_BILLING_MODE: AdminWizardBillingMode = "paystack_link";

export type AdminWizardCustomerBillingSnapshot = {
  customerId: string;
  accountId: string | null;
  monthlyAccountEnabled: boolean;
  billingMode: string | null;
  zohoCustomerId: string | null;
  billingEmail: string | null;
  billingTerms: string | null;
  approvedAt: string | null;
  approvedByAdminId: string | null;
  accountStatusLabel: string;
};

export function formatAdminWizardBillingModeLabel(mode: AdminWizardBillingMode): string {
  switch (mode) {
    case "paystack_link":
      return "Paystack payment link";
    case "offline_payment":
      return "Offline payment";
    case "monthly_account":
      return "Monthly account";
  }
}

export function formatAdminWizardBillingModeDescription(mode: AdminWizardBillingMode): string {
  switch (mode) {
    case "paystack_link":
      return "Customer pays before service using a Paystack link.";
    case "offline_payment":
      return "Admin records EFT/cash/card payment before service.";
    case "monthly_account":
      return "Admin-approved account. Visits are invoiced at month-end.";
  }
}

export function isCustomerEligibleForMonthlyAccountWizard(
  snapshot: AdminWizardCustomerBillingSnapshot | null,
  monthlyBillingFeatureEnabled: boolean,
): boolean {
  if (!monthlyBillingFeatureEnabled) return false;
  if (!snapshot) return false;
  if (!snapshot.monthlyAccountEnabled) return false;
  if (snapshot.billingMode !== "monthly_account") return false;
  if (!snapshot.zohoCustomerId?.trim()) return false;
  if (!snapshot.approvedAt || !snapshot.approvedByAdminId) return false;
  if (!snapshot.billingEmail?.trim() || !snapshot.billingTerms?.trim()) return false;
  if (!snapshot.accountId) return false;
  return true;
}

export function resolveMonthlyAccountDisabledReason(
  snapshot: AdminWizardCustomerBillingSnapshot | null,
  monthlyBillingFeatureEnabled: boolean,
): string | null {
  if (!monthlyBillingFeatureEnabled) {
    return "Monthly account billing is disabled in this environment.";
  }
  if (!snapshot?.accountId) {
    return "Enable monthly billing on the customer profile first.";
  }
  if (!snapshot.monthlyAccountEnabled) {
    return "Enable monthly billing on the customer profile first.";
  }
  if (snapshot.billingMode !== "monthly_account") {
    return "Enable monthly billing on the customer profile first.";
  }
  if (!snapshot.zohoCustomerId?.trim()) {
    return "Link a Zoho customer on the customer profile first.";
  }
  if (!snapshot.approvedAt || !snapshot.approvedByAdminId) {
    return "Monthly billing requires admin approval on the customer profile.";
  }
  if (!snapshot.billingEmail?.trim() || !snapshot.billingTerms?.trim()) {
    return "Billing email and terms are required on the customer profile.";
  }
  return null;
}
