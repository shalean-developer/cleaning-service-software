import { AdminOperationalQueueExplainCard } from "@/components/dashboard/AdminOperationalQueueExplainCard";
import type { AdminOperationalQueueCard } from "@/features/dashboards/adminOperationalQueues";

type Props = {
  cards: AdminOperationalQueueCard[];
  /** When true, omit section heading (parent provides summary label). */
  embedded?: boolean;
};

export function AdminOperationalQueueExplainGrid({ cards, embedded = false }: Props) {
  return (
    <section
      aria-label="Operational queue explanations"
      className={embedded ? "mb-0" : "mb-8"}
    >
      {embedded ? null : (
        <>
          <h2 className="text-sm font-semibold text-zinc-900">Queue guide</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            What each queue means and what to do next. Read-only. counts match the strip above.
          </p>
        </>
      )}
      <ul
        className={`grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3 ${embedded ? "mt-0" : "mt-4"}`}
      >
        {cards.map((card) => (
          <li key={card.key}>
            <AdminOperationalQueueExplainCard card={card} />
          </li>
        ))}
      </ul>
    </section>
  );
}
