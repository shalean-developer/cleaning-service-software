import type { AdminEarningsView as AdminEarningsViewModel } from "@/features/earnings/server/adminEarningsDisplay";
import { AdminEarningsHeader } from "@/components/dashboard/admin/earnings/AdminEarningsHeader";
import { AdminEarningsSummaryCards } from "@/components/dashboard/admin/earnings/AdminEarningsSummaryCards";
import { AdminEarningsServiceMix } from "@/components/dashboard/admin/earnings/AdminEarningsServiceMix";
import { AdminEarningsCleanerPayouts } from "@/components/dashboard/admin/earnings/AdminEarningsCleanerPayouts";

type Props = {
  view: AdminEarningsViewModel;
};

export function AdminEarningsView({ view }: Props) {
  return (
    <div className="space-y-6 sm:space-y-8" aria-label="Revenue and payouts">
      <AdminEarningsHeader period={view.period} />
      <AdminEarningsSummaryCards cards={view.summaryCards} />
      <AdminEarningsServiceMix
        items={view.serviceMix}
        periodLabel={view.periodMixLabel}
      />
      <AdminEarningsCleanerPayouts totals={view.payoutTotals} rows={view.cleanerPayouts} />
    </div>
  );
}
