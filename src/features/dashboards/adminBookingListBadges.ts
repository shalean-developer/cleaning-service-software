import { labelForAdminPaymentFailureAttention } from "@/features/bookings/server/paymentFailureDisplay";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  labelForPaymentStatus,
  toneForBookingStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";
import type { AdminBookingListCardBadge } from "@/components/dashboard/admin/AdminBookingListCard";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";

type BookingListBadgeInput = Pick<
  AdminBookingListItem,
  | "status"
  | "paymentStatus"
  | "paymentFailureReason"
  | "assignmentVisibilityKey"
  | "assignmentAttention"
>;

/** Display-only badge stack for admin booking list cards. */
export function adminBookingListBadges(
  b: BookingListBadgeInput,
): AdminBookingListCardBadge[] {
  const badges: AdminBookingListCardBadge[] = [
    {
      label: labelForBookingStatus(b.status),
      tone: toneForBookingStatus(b.status),
    },
  ];

  if (b.status !== "payment_failed") {
    badges.push({
      label: labelForPaymentStatus(b.paymentStatus),
      tone: toneForPaymentStatus(b.paymentStatus),
    });
  } else {
    badges.push({
      label: labelForAdminPaymentFailureAttention(b.paymentFailureReason),
      tone: "warning",
    });
  }

  const assignmentKey = b.assignmentVisibilityKey ?? b.assignmentAttention;
  if (assignmentKey) {
    badges.push({
      label: labelForAssignmentAttention(assignmentKey),
      tone:
        b.assignmentVisibilityKey === "decline_redispatched" ||
        b.assignmentVisibilityKey === "finding_cleaner" ||
        b.assignmentVisibilityKey === "offer_sent"
          ? "info"
          : "warning",
    });
  }

  return badges;
}
