import type { AdminBookingListCardBadge } from "@/components/dashboard/admin/AdminBookingListCard";

export const ADMIN_BOOKING_LIST_MAX_VISIBLE_BADGES = 2;

export type AdminBookingListBadgePresentation = {
  visible: AdminBookingListCardBadge[];
  overflowCount: number;
};

/** Higher score = higher priority when compressing admin booking badge rows. */
export function priorityScoreForAdminBookingBadge(
  badge: AdminBookingListCardBadge,
): number {
  const label = badge.label.toLowerCase();

  if (
    badge.tone === "danger" ||
    label.includes("payment failed") ||
    label.includes("checkout expired") ||
    label === "failed" ||
    label.includes("payment not completed")
  ) {
    return 100;
  }

  if (
    label.includes("dispatch") ||
    label.includes("assignment") ||
    label.includes("finding cleaner") ||
    label.includes("offer sent") ||
    label.includes("declined") ||
    label.includes("needs assignment") ||
    label.includes("redispatch") ||
    label.includes("max attempts") ||
    label.includes("deferred") ||
    label.includes("overdue") ||
    label.includes("recovery") ||
    label.includes("attention") ||
    (badge.tone === "warning" &&
      !label.includes("today") &&
      !label.includes("same-day") &&
      !label.includes("handover"))
  ) {
    return 80;
  }

  if (
    label.includes("today") ||
    label.includes("same-day") ||
    label.includes("handover day") ||
    label.includes("service today") ||
    label.includes("scheduled today")
  ) {
    return 60;
  }

  if (
    label.includes("turnover") ||
    label.includes("office") ||
    label.includes("move") ||
    label.includes("deep") ||
    label.includes("carpet") ||
    label.includes(" clean")
  ) {
    return 40;
  }

  return 20;
}

/** Caps visible badges; preserves full set for highlight logic via separate input. */
export function presentAdminBookingListBadges(
  badges: readonly AdminBookingListCardBadge[],
  maxVisible: number = ADMIN_BOOKING_LIST_MAX_VISIBLE_BADGES,
): AdminBookingListBadgePresentation {
  if (badges.length <= maxVisible) {
    return { visible: [...badges], overflowCount: 0 };
  }

  const ranked = [...badges].sort(
    (a, b) => priorityScoreForAdminBookingBadge(b) - priorityScoreForAdminBookingBadge(a),
  );
  const visible = ranked.slice(0, maxVisible);
  return {
    visible,
    overflowCount: badges.length - maxVisible,
  };
}
