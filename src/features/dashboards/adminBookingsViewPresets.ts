import { johannesburgCalendarDayKey } from "@/lib/datetime/johannesburgDay";
import { buildAdminBookingsHref, type AdminBookingsUrlParams } from "@/features/dashboards/adminBookingsFilterUrl";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";
import type { BookingStatus } from "@/features/bookings/server/types";

export type AdminBookingsViewChipId =
  | "all"
  | "today"
  | "attention"
  | "recurring"
  | "completed";

export type AdminBookingsViewChip = {
  id: AdminBookingsViewChipId;
  label: string;
};

export const ADMIN_BOOKINGS_VIEW_CHIPS: readonly AdminBookingsViewChip[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "attention", label: "Attention" },
  { id: "recurring", label: "Series" },
  { id: "completed", label: "Completed" },
] as const;

const COMPLETED_VIEW_STATUSES = new Set<BookingStatus>([
  "completed",
  "payout_ready",
  "paid_out",
]);

export function johannesburgTodayDateParam(): string {
  return johannesburgCalendarDayKey();
}

export function resolveAdminBookingsViewChip(input: {
  filter?: AdminBookingFilter;
  view?: string;
  from?: string;
  to?: string;
}): AdminBookingsViewChipId {
  if (input.view === "recurring") return "recurring";
  if (input.view === "completed") return "completed";
  if (input.filter === "assignment_attention") return "attention";
  const today = johannesburgTodayDateParam();
  if (input.from === today && input.to === today) return "today";
  return "all";
}

export function buildAdminBookingsViewChipHref(
  current: AdminBookingsUrlParams & { view?: string },
  chipId: AdminBookingsViewChipId,
): string {
  const today = johannesburgTodayDateParam();

  switch (chipId) {
    case "all":
      return buildAdminBookingsHref(current, {
        filter: undefined,
        from: undefined,
        to: undefined,
        q: current.q,
      });
    case "today":
      return buildAdminBookingsHref(
        { q: current.q },
        { from: today, to: today },
      );
    case "attention":
      return buildAdminBookingsHref({ q: current.q }, { filter: "assignment_attention" });
    case "recurring":
      return buildAdminBookingsHref({ q: current.q }, { view: "recurring" });
    case "completed":
      return buildAdminBookingsHref({ q: current.q }, { view: "completed" });
    default:
      return "/admin/bookings";
  }
}

export function filterAdminBookingsForView(
  bookings: AdminBookingListItem[],
  view: AdminBookingsViewChipId | undefined,
): AdminBookingListItem[] {
  if (view === "recurring") {
    return bookings.filter((b) => b.isRecurring);
  }
  if (view === "completed") {
    return bookings.filter((b) => COMPLETED_VIEW_STATUSES.has(b.status));
  }
  return bookings;
}
