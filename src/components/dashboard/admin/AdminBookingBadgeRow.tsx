import { StatusBadge } from "@/components/dashboard/StatusBadge";
import type { AdminBookingListCardBadge } from "@/components/dashboard/admin/AdminBookingListCard";
import { presentAdminBookingListBadges } from "@/features/dashboards/adminBookingListBadgePresentation";

type Props = {
  badges: readonly AdminBookingListCardBadge[];
  className?: string;
};

/** Renders at most two priority badges plus a +N overflow chip. */
export function AdminBookingBadgeRow({ badges, className = "" }: Props) {
  const { visible, overflowCount } = presentAdminBookingListBadges(badges);

  return (
    <section className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      {visible.map((badge) => (
        <StatusBadge key={badge.label} label={badge.label} tone={badge.tone} />
      ))}
      {overflowCount > 0 ? (
        <StatusBadge label={`+${overflowCount}`} tone="neutral" variant="soft" />
      ) : null}
    </section>
  );
}
