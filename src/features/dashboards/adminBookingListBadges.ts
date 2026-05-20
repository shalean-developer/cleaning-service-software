import { labelForAdminPaymentFailureAttention } from "@/features/bookings/server/paymentFailureDisplay";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  labelForPaymentStatus,
  toneForBookingStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";
import type { AdminBookingListCardBadge } from "@/components/dashboard/admin/AdminBookingListCard";
import { getAirbnbAdminListBadges } from "@/features/dashboards/airbnbOperationalDisplay";
import { buildAdminOperationalLoadBadges } from "@/features/dashboards/server/adminTeamSupportObservation";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";

type BookingListBadgeInput = Pick<
  AdminBookingListItem,
  | "status"
  | "paymentStatus"
  | "paymentFailureReason"
  | "assignmentVisibilityKey"
  | "assignmentAttention"
  | "deferredDispatch"
  | "observation"
  | "serviceLabel"
  | "scheduledStart"
  | "cleanerLabel"
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

  const deferredPhase = b.deferredDispatch?.phase;
  const showDeferredBadge =
    deferredPhase && deferredPhase !== "not_applicable" && b.deferredDispatch?.adminLabel;

  if (showDeferredBadge) {
    badges.push({
      label: b.deferredDispatch!.adminLabel!,
      tone:
        deferredPhase === "dispatch_overdue"
          ? "warning"
          : deferredPhase === "ready_for_dispatch"
            ? "info"
            : "neutral",
    });
  }

  const assignmentKey =
    showDeferredBadge && deferredPhase !== "dispatch_overdue"
      ? null
      : (b.assignmentVisibilityKey ?? b.assignmentAttention);
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

  for (const airbnbBadge of getAirbnbAdminListBadges({
    serviceLabel: b.serviceLabel,
    scheduledStart: b.scheduledStart,
  })) {
    badges.push(airbnbBadge);
  }

  for (const loadBadge of buildAdminOperationalLoadBadges(b.observation.operationalLoad)) {
    badges.push(loadBadge);
  }

  if (b.observation.isTwoCleanerRequest && b.observation.teamRequestFulfillmentLabel) {
    const fulfilled = b.observation.teamRequestFulfillment?.fulfilledCleanerCount === 2;
    badges.push({
      label: b.observation.teamRequestFulfillmentLabel,
      tone: fulfilled ? "success" : b.observation.teamRequestFulfillment ? "warning" : "neutral",
    });
  }

  if (b.observation.isTwoCleanerRequest && b.observation.coordinationStatusLabel) {
    const status = b.observation.teamSupportOps.coordinationStatus?.status;
    badges.push({
      label: b.observation.coordinationStatusLabel,
      tone:
        status === "fully_coordinated"
          ? "success"
          : status === "partially_fulfilled"
            ? "info"
            : "neutral",
    });
  }

  return badges;
}
