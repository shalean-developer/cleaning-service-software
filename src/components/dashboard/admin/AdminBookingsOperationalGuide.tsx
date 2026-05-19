import { AdminOperationalQueueContextCard } from "@/components/dashboard/AdminOperationalQueueContextCard";
import {
  ADMIN_DETAILS_BODY_CLASS,
  ADMIN_DETAILS_DISCLOSURE_CLASS,
  ADMIN_DETAILS_SUMMARY_CLASS,
} from "@/features/dashboards/adminDisplay";
import type { AdminOperationalQueueCard } from "@/features/dashboards/adminOperationalQueues";
import { toneForOperationalQueueSeverity } from "@/features/dashboards/adminOperationalQueues";

type Props = {
  card: AdminOperationalQueueCard;
};

/** Collapsed operational context for active queue filter on /admin/bookings. */
export function AdminBookingsOperationalGuide({ card }: Props) {
  const openByDefault =
    card.severity === "urgent" || card.severity === "action_required";

  return (
    <details className={`mb-4 ${ADMIN_DETAILS_DISCLOSURE_CLASS}`} open={openByDefault || undefined}>
      <summary className={ADMIN_DETAILS_SUMMARY_CLASS}>
        Operational guide — {card.label}
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            toneForOperationalQueueSeverity(card.severity) === "danger"
              ? "bg-red-100 text-red-900"
              : toneForOperationalQueueSeverity(card.severity) === "warning"
                ? "bg-amber-100 text-amber-950"
                : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {card.count} in queue
        </span>
      </summary>
      <div className={`${ADMIN_DETAILS_BODY_CLASS} px-1 pb-1 pt-0 sm:px-1`}>
        <AdminOperationalQueueContextCard card={card} embedded />
      </div>
    </details>
  );
}
