import type { AdminTeamEarningsReconciliation } from "@/features/dashboards/server/types";
import { ADMIN_DETAIL_INSET_CLASS } from "@/features/dashboards/adminDisplay";

type Props = {
  reconciliation: AdminTeamEarningsReconciliation;
};

/** Surfaces blocked team earnings above the fold without duplicating the full reconciliation panel. */
export function AdminBookingEarningsAttentionBanner({ reconciliation }: Props) {
  if (reconciliation.status !== "blocked" && reconciliation.blockingIssues.length === 0) {
    return null;
  }

  return (
    <section
      className={`${ADMIN_DETAIL_INSET_CLASS} border-red-200/80 bg-red-50/90 px-3.5 py-3`}
      role="alert"
    >
      <p className="text-sm font-semibold text-red-950">Earnings / payout blocked</p>
      <ul className="mt-1.5 space-y-0.5 text-sm text-red-900">
        {reconciliation.blockingIssues.map((issue) => (
          <li key={issue.code}>
            <span className="font-medium">{issue.code}:</span> {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
