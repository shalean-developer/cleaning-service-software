import { customerBookServicePath } from "@/features/booking-wizard/bookServiceRoute";
import type { BookingStatus } from "@/features/bookings/server/types";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import {
  filterCustomerBookingsForTab,
} from "@/features/dashboards/customerBookingsDashboardDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

/** Rebook path from booking metadata (falls back to book hub). */
export function customerHubRebookHref(serviceSlug: string | null): string {
  if (serviceSlug && isServiceSlug(serviceSlug)) {
    return customerBookServicePath(serviceSlug);
  }
  return "/customer/book";
}

const WIZARD_TIMEZONE = "Africa/Johannesburg";

export type CustomerHubVisitStatusStep = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
};

const HUB_VISIT_STATUS_STEP_DEFS = [
  { id: "booked", label: "Booked" },
  { id: "team", label: "Team assigned" },
  { id: "arrival", label: "Arrival locked" },
  { id: "ahead", label: "Visit ahead" },
] as const;

/** Four-step visit progress strip for the customer hub (display only). */
export function customerHubVisitStatusSteps(status: BookingStatus): CustomerHubVisitStatusStep[] {
  const activeIndex = hubVisitStatusActiveIndex(status);
  const cappedIndex = Math.min(activeIndex, HUB_VISIT_STATUS_STEP_DEFS.length - 1);
  const allComplete =
    status === "completed" || status === "payout_ready" || status === "paid_out";

  return HUB_VISIT_STATUS_STEP_DEFS.map((step, index) => ({
    ...step,
    state: allComplete
      ? "complete"
      : index < cappedIndex
        ? "complete"
        : index === cappedIndex
          ? "current"
          : "upcoming",
  }));
}

function hubVisitStatusActiveIndex(status: BookingStatus): number {
  switch (status) {
    case "draft":
    case "cancelled":
    case "pending_payment":
    case "payment_failed":
      return 0;
    case "confirmed":
    case "pending_assignment":
      return 1;
    case "assigned":
      return 2;
    case "in_progress":
      return 3;
    case "completed":
    case "payout_ready":
    case "paid_out":
      return 4;
    default:
      return 0;
  }
}

export function customerHubHeroCopy(params: {
  displayName: string;
  hasUpcoming: boolean;
}): { eyebrow: string; title: string; subtitle: string } {
  return {
    eyebrow: "HOME CARE",
    title: `Welcome back, ${params.displayName}`,
    subtitle: params.hasUpcoming
      ? "Upcoming visits and updates."
      : "Book your next visit when you are ready.",
  };
}

/** Second nearest upcoming visit for the “Also scheduled” inset. */
export function pickAlsoScheduledUpcoming(
  bookings: CustomerBookingListItem[],
  featuredId: string | null,
): CustomerBookingListItem | null {
  const upcoming = filterCustomerBookingsForTab(bookings, "upcoming");
  const rest = featuredId ? upcoming.filter((b) => b.id !== featuredId) : upcoming.slice(1);
  if (rest.length === 0) return null;
  return [...rest].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0] ?? null;
}

/** Completed visits for the “Recent stays” list. */
export function customerHubRecentStays(
  bookings: CustomerBookingListItem[],
  limit = 2,
): CustomerBookingListItem[] {
  return filterCustomerBookingsForTab(bookings, "completed")
    .sort((a, b) => b.scheduledStart.localeCompare(a.scheduledStart))
    .slice(0, limit);
}

export function formatHubVisitScheduleLine(booking: CustomerBookingListItem): string {
  try {
    const start = new Date(booking.scheduledStart);
    const day = new Intl.DateTimeFormat("en-ZA", {
      timeZone: WIZARD_TIMEZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(start);
    const time = new Intl.DateTimeFormat("en-ZA", {
      timeZone: WIZARD_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(start);
    const period = schedulePeriodLabel(start);
    const area =
      booking.display.suburb?.trim() ||
      booking.display.city?.trim() ||
      booking.display.locationSummary.trim() ||
      "";
    return [day, period, time, area].filter(Boolean).join(" · ");
  } catch {
    return booking.scheduleLabel;
  }
}

function schedulePeriodLabel(date: Date): string | null {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: WIZARD_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function formatHubStayDateLine(booking: CustomerBookingListItem): string {
  try {
    const start = new Date(booking.scheduledStart);
    const date = new Intl.DateTimeFormat("en-ZA", {
      timeZone: WIZARD_TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(start);
    const area =
      booking.display.suburb?.trim() ||
      booking.display.city?.trim() ||
      booking.display.locationSummary.trim() ||
      "";
    return area ? `${date} · ${area}` : date;
  } catch {
    return booking.scheduleLabel;
  }
}

export function customerHubVisitMetaTags(booking: CustomerBookingListItem): string[] {
  const tags: string[] = [];
  if (booking.display.equipmentSupplyOperationalLabel?.trim()) {
    tags.push(booking.display.equipmentSupplyOperationalLabel.trim());
  }
  if (booking.deferredAssignmentMessage?.trim()) {
    tags.push("Assignment pending");
  } else if (booking.assignedCleanerLabel?.trim()) {
    tags.push("Cleaner assigned");
  }
  if (booking.isSeriesVisit) {
    tags.push("Recurring held");
  }
  if (booking.display.teamRequestFulfillmentLabel?.trim()) {
    tags.push(booking.display.teamRequestFulfillmentLabel.trim());
  }
  return tags.slice(0, 3);
}

export function customerHubVisitSummaryLine(booking: CustomerBookingListItem): string {
  const parts: string[] = ["Estimated duration"];
  if (booking.display.homeSizeSummary?.trim()) {
    parts.push(booking.display.homeSizeSummary.trim());
  }
  if (booking.display.addonsSummary?.trim()) {
    parts.push(booking.display.addonsSummary.trim());
  }
  return parts.join(" · ");
}

export function customerHubCleanerInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export function customerHubFullAddress(booking: CustomerBookingListItem): string {
  const line = booking.display.addressLine?.trim();
  const suburb = booking.display.suburb?.trim();
  const city = booking.display.city?.trim();
  if (line && suburb && city) return `${line}, ${suburb}, ${city}`;
  if (suburb && city) return `${suburb}, ${city}`;
  return booking.display.locationSummary.trim();
}
