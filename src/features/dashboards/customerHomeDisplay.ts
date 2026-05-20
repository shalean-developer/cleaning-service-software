import type { BookingStatus } from "@/features/bookings/server/types";
import {
  CUSTOMER_FINDING_CLEANER_LABEL,
  labelForCustomerBookingStatus,
  labelForCustomerPaymentStatus,
} from "@/features/bookings/server/paymentFailureDisplay";
import { customerBookServicePath } from "@/features/booking-wizard/bookServiceRoute";
import type { ServiceSlug } from "@/features/pricing/server/types";
import type { LifecycleEvent } from "@/features/dashboards/server/lifecycleTimeline";
import {
  customerBookingMatchesFilterTab,
  filterCustomerBookingsForTab,
} from "@/features/dashboards/customerBookingsDashboardDisplay";
import { customerBookingListCardLayers } from "@/features/dashboards/customerBookingListCardDisplay";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";

const WIZARD_TIMEZONE = "Africa/Johannesburg";

/** Greeting bucket for the compact home hero (display only). */
export function customerHomeGreetingPeriod(
  at: Date = new Date(),
): "morning" | "afternoon" | "evening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", {
      timeZone: WIZARD_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(at),
  );
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function customerHomeGreetingLabel(period: ReturnType<typeof customerHomeGreetingPeriod>): string {
  switch (period) {
    case "morning":
      return "Good morning";
    case "afternoon":
      return "Good afternoon";
    default:
      return "Good evening";
  }
}

/** First name or email local-part for the hero line. */
export function customerHomeDisplayName(fullName: string | null, email: string): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const first = trimmed.split(/\s+/)[0];
    if (first) return first;
  }
  const local = email.split("@")[0]?.trim();
  return local || "there";
}

export type CustomerHomeSummaryStats = {
  upcoming: number;
  completed: number;
  pendingPayments: number;
  savedArea: string | null;
};

/** Counts and saved area from existing list items only. */
export function customerHomeSummaryStats(
  bookings: CustomerBookingListItem[],
): CustomerHomeSummaryStats {
  const upcoming = filterCustomerBookingsForTab(bookings, "upcoming").length;
  const completed = filterCustomerBookingsForTab(bookings, "completed").length;
  const pendingPayments = filterCustomerBookingsForTab(bookings, "unpaid").length;
  const savedArea = customerHomeSavedAreaLabel(bookings);

  return { upcoming, completed, pendingPayments, savedArea };
}

/** Most recent booking with a usable location label. */
export function customerHomeSavedAreaLabel(bookings: CustomerBookingListItem[]): string | null {
  const sorted = [...bookings].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const booking of sorted) {
    const { suburb, city, locationSummary } = booking.display;
    if (suburb && city) return `${suburb}, ${city}`;
    if (suburb) return suburb;
    if (city) return city;
    if (locationSummary.trim()) return locationSummary;
  }
  return null;
}

/** Nearest upcoming booking by scheduled start (presentation only). */
export function pickFeaturedUpcomingBooking(
  bookings: CustomerBookingListItem[],
): CustomerBookingListItem | null {
  const upcoming = filterCustomerBookingsForTab(bookings, "upcoming");
  if (upcoming.length === 0) return null;
  return [...upcoming].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))[0] ?? null;
}

export type CustomerHomeHeroCopy = {
  title: string;
  subtitle: string;
};

export function customerHomeHeroCopy(params: {
  displayName: string;
  featured: CustomerBookingListItem | null;
  at?: Date;
}): CustomerHomeHeroCopy {
  const period = customerHomeGreetingPeriod(params.at);
  const greeting = customerHomeGreetingLabel(period);

  if (!params.featured) {
    return {
      title: "Welcome back 👋",
      subtitle: "You have no upcoming bookings. Book your next clean in under 2 minutes.",
    };
  }

  const scheduleShort = formatUpcomingScheduleShort(
    params.featured.scheduledStart,
    params.featured.scheduledEnd,
    params.at,
  );
  const cleanerLine = customerHomeCleanerStateLine(params.featured);

  return {
    title: `${greeting}, ${params.displayName} 👋`,
    subtitle: `Your next cleaning is ${scheduleShort}.${cleanerLine ? ` ${cleanerLine}` : ""}`,
  };
}

/** Relative day + time window for the hero and upcoming card eyebrow. */
export function formatUpcomingScheduleShort(
  scheduledStart: string,
  scheduledEnd: string,
  at: Date = new Date(),
): string {
  try {
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    const dayLabel = relativeDayLabel(start, at);
    const timeFmt = new Intl.DateTimeFormat("en-ZA", {
      timeZone: WIZARD_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
    });
    const window = `${timeFmt.format(start)}–${timeFmt.format(end)}`;
    return `${dayLabel} at ${window}`;
  } catch {
    return "soon";
  }
}

function relativeDayLabel(date: Date, at: Date): string {
  const fmt = new Intl.DateTimeFormat("en-ZA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const target = fmt.format(date);
  const today = fmt.format(at);
  if (target === today) return "today";

  const tomorrow = new Date(at);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target === fmt.format(tomorrow)) return "tomorrow";

  const weekday = new Intl.DateTimeFormat("en-ZA", {
    timeZone: WIZARD_TIMEZONE,
    weekday: "long",
  }).format(date);
  return `on ${weekday}`;
}

/** Short cleaner / assignment line for the hero subtitle. */
export function customerHomeCleanerStateLine(booking: CustomerBookingListItem): string | null {
  const layers = customerBookingListCardLayers({
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentFailureReason: booking.paymentFailureReason,
    isUpcoming: booking.isUpcoming,
    display: booking.display,
    deferredAssignmentMessage: booking.deferredAssignmentMessage,
    assignedCleanerLabel: booking.assignedCleanerLabel,
  });

  if (layers.supportingMessage?.kind === "cleaner") {
    return "Your cleaner is assigned.";
  }

  if (booking.status === "pending_assignment") {
    return "Cleaner assignment is in progress.";
  }

  if (booking.status === "payment_failed" || booking.status === "pending_payment") {
    return "Complete payment to confirm your booking.";
  }

  if (layers.supportingMessage?.kind === "assignment") {
    return layers.supportingMessage.text.endsWith(".")
      ? layers.supportingMessage.text
      : `${layers.supportingMessage.text}.`;
  }

  return null;
}

export type CustomerHomeLifecycleStep = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming";
};

const HOME_LIFECYCLE_STEP_DEFS = [
  { id: "confirmed", label: "Booking confirmed" },
  { id: "payment", label: "Payment received" },
  { id: "matching", label: "Matching cleaner" },
  { id: "assigned", label: "Cleaner assigned" },
  { id: "completed", label: "Cleaning completed" },
] as const;

/** Maps booking status to a fixed customer journey stepper (display only). */
export function customerHomeLifecycleSteps(status: BookingStatus): CustomerHomeLifecycleStep[] {
  const activeIndex = lifecycleActiveIndex(status);
  return HOME_LIFECYCLE_STEP_DEFS.map((step, index) => ({
    ...step,
    state:
      index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming",
  }));
}

function lifecycleActiveIndex(status: BookingStatus): number {
  switch (status) {
    case "draft":
    case "cancelled":
      return 0;
    case "pending_payment":
    case "payment_failed":
      return 1;
    case "confirmed":
      return 2;
    case "pending_assignment":
      return 2;
    case "assigned":
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

export type CustomerHomeActivityItem = {
  id: string;
  at: string;
  title: string;
  detail: string | null;
};

/** Recent feed from lifecycle events when available, else synthetic rows from list items. */
export function customerHomeRecentActivity(
  bookings: CustomerBookingListItem[],
  timelineEvents: LifecycleEvent[] | null,
): CustomerHomeActivityItem[] {
  if (timelineEvents && timelineEvents.length > 0) {
    return [...timelineEvents]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5)
      .map((event) => ({
        id: event.id,
        at: event.at,
        title: event.title.replace(/^Current:\s*/, ""),
        detail: event.detail,
      }));
  }

  return [...bookings]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)
    .map((booking) => ({
      id: booking.id,
      at: booking.updatedAt,
      title: syntheticActivityTitle(booking),
      detail: booking.display.serviceLabel,
    }));
}

function syntheticActivityTitle(booking: CustomerBookingListItem): string {
  if (booking.assignedCleanerLabel) return "Cleaner assigned";
  if (booking.paymentStatus === "paid" && booking.status === "confirmed") {
    return "Payment received";
  }
  if (
    booking.status === "completed" ||
    booking.status === "payout_ready" ||
    booking.status === "paid_out"
  ) {
    return "Booking completed";
  }
  if (booking.status === "pending_assignment") {
    return CUSTOMER_FINDING_CLEANER_LABEL;
  }
  if (booking.status === "payment_failed") {
    return labelForCustomerBookingStatus(booking.status, booking.paymentFailureReason);
  }
  if (booking.paymentStatus) {
    return labelForCustomerPaymentStatus(booking.paymentStatus);
  }
  return labelForCustomerBookingStatus(booking.status, booking.paymentFailureReason);
}

export type CustomerHomeQuickAction = {
  slug: ServiceSlug;
  label: string;
  description: string;
  href: string;
};

/** Quick rebook tiles — existing book routes only. */
export const CUSTOMER_HOME_QUICK_ACTIONS: CustomerHomeQuickAction[] = [
  {
    slug: "regular-cleaning",
    label: "Regular cleaning",
    description: "Routine home clean",
    href: customerBookServicePath("regular-cleaning"),
  },
  {
    slug: "deep-cleaning",
    label: "Deep cleaning",
    description: "Thorough top-to-bottom",
    href: customerBookServicePath("deep-cleaning"),
  },
  {
    slug: "moving-cleaning",
    label: "Move-out cleaning",
    description: "Inspection-ready handover",
    href: customerBookServicePath("moving-cleaning"),
  },
  {
    slug: "airbnb-cleaning",
    label: "Same-day turnover",
    description: "Fast guest-ready prep",
    href: customerBookServicePath("airbnb-cleaning"),
  },
];

export function customerHomeShowsRecurringCta(bookings: CustomerBookingListItem[]): boolean {
  const completed = filterCustomerBookingsForTab(bookings, "completed").length;
  const upcoming = filterCustomerBookingsForTab(bookings, "upcoming").length;
  return completed > 0 && upcoming === 0;
}

/** Whether a booking tab count should link to the bookings list (presentation). */
export function customerHomeSummaryCardHref(
  stat: keyof CustomerHomeSummaryStats,
): string | null {
  if (stat === "savedArea") return null;
  return "/customer/bookings";
}

export function customerHomeSummaryValueForStat(
  stat: keyof CustomerHomeSummaryStats,
  stats: CustomerHomeSummaryStats,
): string {
  switch (stat) {
    case "upcoming":
      return String(stats.upcoming);
    case "completed":
      return String(stats.completed);
    case "pendingPayments":
      return String(stats.pendingPayments);
    case "savedArea":
      return stats.savedArea ?? "Add on booking";
    default:
      return "0";
  }
}

export function customerHomeBookingMatchesUnpaid(booking: CustomerBookingListItem): boolean {
  return customerBookingMatchesFilterTab(booking, "unpaid");
}
