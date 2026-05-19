import { AdminOperationalQueueExplainGrid } from "@/components/dashboard/AdminOperationalQueueExplainGrid";
import { ADMIN_DETAIL_CARD_CLASS } from "@/features/dashboards/adminDisplay";
import type { AdminOperationalQueueCard } from "@/features/dashboards/adminOperationalQueues";

type Props = {
  cards: AdminOperationalQueueCard[];
};

/** Collapsed-by-default queue explainability (Stage 7P-1B). */
export function AdminOperationalQueueGuideDetails({ cards }: Props) {
  return (
    <details className={`mb-5 ${ADMIN_DETAIL_CARD_CLASS}`}>
      <summary className="cursor-pointer list-none rounded-2xl px-3.5 py-2 text-xs font-semibold text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden sm:px-4">
        How to use this dashboard
      </summary>
      <div className="border-t border-zinc-100 px-3.5 pb-3 pt-2.5 sm:px-4">
        <AdminOperationalQueueExplainGrid cards={cards} embedded />
      </div>
    </details>
  );
}
