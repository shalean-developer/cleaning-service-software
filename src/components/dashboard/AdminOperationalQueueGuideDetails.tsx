import { AdminOperationalQueueExplainGrid } from "@/components/dashboard/AdminOperationalQueueExplainGrid";
import type { AdminOperationalQueueCard } from "@/features/dashboards/adminOperationalQueues";

type Props = {
  cards: AdminOperationalQueueCard[];
};

/** Collapsed-by-default queue explainability (Stage 7P-1B). */
export function AdminOperationalQueueGuideDetails({ cards }: Props) {
  return (
    <details className="mb-8 rounded-xl border border-zinc-200 bg-white">
      <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-semibold text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        Queue guide — what each queue means
      </summary>
      <div className="border-t border-zinc-100 px-4 pb-4 pt-4">
        <AdminOperationalQueueExplainGrid cards={cards} embedded />
      </div>
    </details>
  );
}
