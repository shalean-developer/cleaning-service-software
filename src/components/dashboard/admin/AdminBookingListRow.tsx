import Link from "next/link";
import type { AdminBookingListCardBadge } from "@/components/dashboard/admin/AdminBookingListCard";
import { AdminBookingBadgeRow } from "@/components/dashboard/admin/AdminBookingBadgeRow";
import {
  getAirbnbAdminBookingListCopy,
  isAirbnbOperationalBooking,
} from "@/features/dashboards/airbnbOperationalDisplay";
import {
  getDeepAdminBookingListCopy,
  isDeepOperationalBooking,
} from "@/features/dashboards/deepOperationalDisplay";
import {
  getCarpetAdminBookingListCopy,
  isCarpetOperationalBooking,
} from "@/features/dashboards/carpetOperationalDisplay";
import {
  getMovingAdminBookingListCopy,
  isMovingOperationalBooking,
} from "@/features/dashboards/movingOperationalDisplay";
import {
  getOfficeAdminBookingListCopy,
  isOfficeOperationalBooking,
} from "@/features/dashboards/officeOperationalDisplay";
import { ADMIN_LIST_CARD_CLASS } from "@/features/dashboards/adminDisplay";
import { UI_LIST_META_CLASS, UI_LIST_TITLE_CLASS } from "@/lib/ui/productUiTokens";

type Props = {
  href: string;
  badges: AdminBookingListCardBadge[];
  serviceLabel: string;
  customerLabel: string;
  scheduleLabel: string;
  priceLabel: string;
  nextAction: string | null;
  cleanerLabel?: string | null;
};

export function AdminBookingListRow({
  href,
  badges,
  serviceLabel,
  customerLabel,
  scheduleLabel,
  priceLabel,
  nextAction,
  cleanerLabel,
}: Props) {
  const highlight = badges.some((b) => b.tone === "danger" || b.tone === "warning");
  const airbnb = isAirbnbOperationalBooking({ serviceLabel });
  const office = isOfficeOperationalBooking({ serviceLabel });
  const moving = isMovingOperationalBooking({ serviceLabel });
  const deep = isDeepOperationalBooking({ serviceLabel });
  const carpet = isCarpetOperationalBooking({ serviceLabel });
  const opsList = airbnb
    ? getAirbnbAdminBookingListCopy()
    : office
      ? getOfficeAdminBookingListCopy()
      : moving
        ? getMovingAdminBookingListCopy()
        : deep
          ? getDeepAdminBookingListCopy()
          : carpet
            ? getCarpetAdminBookingListCopy()
            : null;

  return (
    <article
      className={`${ADMIN_LIST_CARD_CLASS} ${
        highlight ? "border-amber-200/90 bg-amber-50/20" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <AdminBookingBadgeRow badges={badges} />
          <h3 className={`mt-1.5 ${UI_LIST_TITLE_CLASS}`}>{serviceLabel}</h3>
          {opsList ? (
            <p className={`mt-0.5 text-xs font-medium text-sky-900/90`}>
              {opsList.serviceSubtitle}
            </p>
          ) : null}
          <p className={`mt-0.5 ${UI_LIST_META_CLASS} text-zinc-700`}>{customerLabel}</p>
          <p className={`mt-0.5 text-xs ${UI_LIST_META_CLASS}`}>
            {scheduleLabel}
            {" · "}
            {priceLabel}
            {cleanerLabel ? ` · ${cleanerLabel}` : " · Unassigned"}
          </p>
          {nextAction ? (
            <p className="mt-1.5 text-xs font-medium text-zinc-800">{nextAction}</p>
          ) : null}
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          {opsList?.listCtaLabel ?? "Open"}
        </Link>
      </div>
    </article>
  );
}
