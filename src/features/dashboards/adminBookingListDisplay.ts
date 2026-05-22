import { adminAirbnbBookingListNextAction } from "@/features/dashboards/airbnbOperationalDisplay";
import { adminDeepBookingListNextAction } from "@/features/dashboards/deepOperationalDisplay";
import { adminCarpetBookingListNextAction } from "@/features/dashboards/carpetOperationalDisplay";
import { adminMovingBookingListNextAction } from "@/features/dashboards/movingOperationalDisplay";
import { adminOfficeBookingListNextAction } from "@/features/dashboards/officeOperationalDisplay";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";

type BookingRowInput = Pick<
  AdminBookingListItem,
  | "status"
  | "paymentStatus"
  | "paymentFailureReason"
  | "assignmentVisibilityKey"
  | "assignmentAttention"
  | "deferredDispatch"
  | "observation"
>;

function defaultAdminBookingListNextAction(booking: BookingRowInput): string | null {
  if (booking.status === "payment_failed") {
    return "Customer must retry payment. open booking to verify notifications.";
  }

  const deferredPhase = booking.deferredDispatch?.phase;
  if (deferredPhase === "dispatch_overdue") {
    return "Deferred dispatch overdue. open booking or assignments workbench.";
  }
  if (deferredPhase === "ready_for_dispatch") {
    return "Deferred dispatch ready. dispatch from booking detail when eligible.";
  }

  if (
    booking.observation.isTwoCleanerRequest &&
    booking.observation.teamSupportOps.coordinationStatus?.status === "awaiting_coordination"
  ) {
    return "Team support needs coordination. open booking for team ops panel.";
  }

  const key = booking.assignmentVisibilityKey ?? booking.assignmentAttention;
  switch (key) {
    case "needs_assignment":
      return "Send offer or assign cleaner on booking detail.";
    case "selected_declined_admin":
    case "max_attempts_admin":
      return "Redispatch. send offer to an eligible cleaner.";
    case "dispatch_not_started":
      return "Dispatch not started. recover or send offer on detail.";
    default:
      break;
  }

  if (booking.status === "completed" || booking.status === "payout_ready") {
    return "Review payout readiness on booking detail.";
  }

  if (booking.status === "paid_out") {
    return null;
  }

  if (booking.assignmentAttention === "attention_required") {
    return "Assignment needs triage. open booking detail.";
  }

  return null;
}

/** Short next-step copy for admin booking list rows (presentation only). */
export function adminBookingListNextAction(
  booking: BookingRowInput & { serviceLabel: string },
): string | null {
  const defaultAction = defaultAdminBookingListNextAction(booking);
  const afterAirbnb = adminAirbnbBookingListNextAction(defaultAction, {
    serviceLabel: booking.serviceLabel,
    status: booking.status,
  });
  const afterMoving = adminMovingBookingListNextAction(afterAirbnb, {
    serviceLabel: booking.serviceLabel,
    status: booking.status,
  });
  const afterOffice = adminOfficeBookingListNextAction(afterMoving, {
    serviceLabel: booking.serviceLabel,
    status: booking.status,
  });
  const afterDeep = adminDeepBookingListNextAction(afterOffice, {
    serviceLabel: booking.serviceLabel,
    status: booking.status,
  });
  return adminCarpetBookingListNextAction(afterDeep, {
    serviceLabel: booking.serviceLabel,
    status: booking.status,
  });
}

export function adminBookingListNeedsHighlight(booking: BookingRowInput): boolean {
  if (booking.status === "payment_failed") return true;
  if (booking.deferredDispatch?.phase === "dispatch_overdue") return true;
  if (
    booking.observation.isTwoCleanerRequest &&
    booking.observation.teamSupportOps.coordinationStatus?.status === "awaiting_coordination"
  ) {
    return true;
  }
  const key = booking.assignmentVisibilityKey ?? booking.assignmentAttention;
  return (
    key === "needs_assignment" ||
    key === "selected_declined_admin" ||
    key === "max_attempts_admin" ||
    key === "dispatch_not_started" ||
    booking.assignmentAttention === "attention_required"
  );
}
