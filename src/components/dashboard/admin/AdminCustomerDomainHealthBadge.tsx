import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForCustomerDomainHealth,
  toneForCustomerDomainHealth,
} from "@/features/customers/server/admin/adminCustomerOperationalDisplay";
import type { CustomerDomainHealthStatus } from "@/features/customers/server/admin/customerDomainHealth";

type Props = {
  health: CustomerDomainHealthStatus;
  provisioningHealthy: boolean;
  showDetail?: boolean;
};

export function AdminCustomerDomainHealthBadge({
  health,
  provisioningHealthy,
  showDetail = false,
}: Props) {
  const showSecondaryWarning = !provisioningHealthy && health.code !== "HEALTHY";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={labelForCustomerDomainHealth(health)}
          tone={toneForCustomerDomainHealth(health)}
          variant="soft"
        />
        {showSecondaryWarning ? (
          <StatusBadge label="Needs attention" tone="warning" variant="soft" />
        ) : null}
      </div>
      {showDetail ? <p className="text-sm text-zinc-600">{health.detail}</p> : null}
    </div>
  );
}
