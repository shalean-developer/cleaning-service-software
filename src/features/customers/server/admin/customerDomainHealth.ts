import type { UserRole } from "@/lib/database/types";

export type CustomerDomainHealthCode =
  | "HEALTHY"
  | "PROVISIONING_INCOMPLETE"
  | "ROLE_MISMATCH"
  | "DUAL_DOMAIN"
  | "ORPHAN_DOMAIN_ROW"
  | "ORPHAN_PROFILE";

export type CustomerDomainHealthStatus = {
  code: CustomerDomainHealthCode;
  label: string;
  tone: "success" | "warning" | "danger";
  detail: string;
};

export function resolveCustomerDomainHealth(input: {
  profileRole: UserRole | null;
  hasCustomerRow: boolean;
  hasCleanersRow: boolean;
}): CustomerDomainHealthStatus {
  const { profileRole, hasCustomerRow, hasCleanersRow } = input;

  if (!profileRole) {
    return {
      code: "ORPHAN_PROFILE",
      label: "Orphan profile",
      tone: "danger",
      detail: "customers row exists without a profiles record.",
    };
  }

  if (hasCustomerRow && hasCleanersRow) {
    return {
      code: "DUAL_DOMAIN",
      label: "Dual domain",
      tone: "danger",
      detail: "Profile has both customers and cleaners rows.",
    };
  }

  if (profileRole !== "customer" && hasCustomerRow) {
    return {
      code: "ROLE_MISMATCH",
      label: "Domain mismatch",
      tone: "warning",
      detail: `profiles.role is ${profileRole} but a customers row is attached.`,
    };
  }

  if (profileRole === "customer" && !hasCustomerRow) {
    return {
      code: "PROVISIONING_INCOMPLETE",
      label: "Provisioning incomplete",
      tone: "warning",
      detail: "Customer profile is missing a customers domain row.",
    };
  }

  if (profileRole === "customer" && hasCustomerRow) {
    return {
      code: "HEALTHY",
      label: "Provisioning healthy",
      tone: "success",
      detail: "Customer profile and domain row are aligned.",
    };
  }

  return {
    code: "HEALTHY",
    label: "No customer domain",
    tone: "success",
    detail: "Profile is not a customer; no customers row expected.",
  };
}

export function isProvisioningHealthy(health: CustomerDomainHealthStatus): boolean {
  return health.code === "HEALTHY" && health.tone === "success";
}
