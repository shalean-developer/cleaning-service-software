import type { CustomerDomainHealthStatus } from "./customerDomainHealth";

export function labelForCustomerDomainHealth(health: CustomerDomainHealthStatus): string {
  return health.label;
}

export function toneForCustomerDomainHealth(
  health: CustomerDomainHealthStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (health.tone === "success") return "success";
  if (health.tone === "warning") return "warning";
  if (health.tone === "danger") return "danger";
  return "neutral";
}
