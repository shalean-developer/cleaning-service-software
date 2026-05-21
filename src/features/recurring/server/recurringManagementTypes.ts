import type { BookingStatus } from "@/features/bookings/server/types";
import type { BookingSeriesStatus, RecurringSeriesFrequency } from "../types";

export type RecurringSeriesActionsAllowed = {
  canPause: boolean;
  canResume: boolean;
  canCancelSeries: boolean;
  canSkipNext: boolean;
  canRescheduleNext: boolean;
  canPayNextVisit: boolean;
  canRequestPause: boolean;
  canRequestCancel: boolean;
  canRequestReschedule: boolean;
};

export type RecurringSeriesTimelineEntry = {
  bookingId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: BookingStatus;
  paymentStatus: string | null;
  isAnchor: boolean;
  isGeneratedChild: boolean;
  scheduleLabel: string;
  paymentLabel: string;
};

export type AdminRecurringSeriesListItem = {
  seriesId: string;
  frequency: RecurringSeriesFrequency;
  frequencyLabel: string;
  status: BookingSeriesStatus;
  statusLabel: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceSlug: string;
  serviceLabel: string;
  suburb: string | null;
  addressSummary: string;
  nextOccurrenceAt: string | null;
  nextOccurrenceScheduleLabel: string | null;
  nextOccurrencePaymentRequired: boolean;
  nextOccurrenceBookingId: string | null;
  childBookingsCount: number;
  lastCompletedVisitAt: string | null;
  createdFromBookingId: string;
  createdAt: string;
  latestChildBookingId: string | null;
  actions: RecurringSeriesActionsAllowed;
};

export type AdminRecurringSeriesDetail = AdminRecurringSeriesListItem & {
  timezone: string;
  priceCents: number;
  priceLabel: string;
  anchorScheduledStart: string;
  timeline: RecurringSeriesTimelineEntry[];
  auditNotes: string[];
};

export type CustomerRecurringSeriesListItem = {
  seriesId: string;
  frequency: RecurringSeriesFrequency;
  frequencyLabel: string;
  status: BookingSeriesStatus;
  statusLabel: string;
  serviceLabel: string;
  suburb: string | null;
  locationSummary: string;
  nextOccurrenceAt: string | null;
  nextOccurrenceScheduleLabel: string | null;
  nextOccurrencePaymentRequired: boolean;
  nextOccurrenceBookingId: string | null;
  unpaidChildCount: number;
  paidUpcomingCount: number;
  completedVisitCount: number;
  actions: RecurringSeriesActionsAllowed;
};

export type CustomerRecurringSeriesDetail = CustomerRecurringSeriesListItem & {
  timeline: RecurringSeriesTimelineEntry[];
  createdFromBookingId: string;
};

/** Client-safe list filter shape (used by admin recurring toolbar). */
export type AdminRecurringListQuery = {
  status?: "active" | "paused" | "cancelled";
  frequency?: "weekly" | "biweekly" | "monthly";
  paymentRequired?: boolean;
  search?: string;
};

export type AdminRecurringSeriesSummary = {
  activeCount: number;
  pausedCount: number;
  paymentRequiredChildrenCount: number;
  nextSevenDaysCount: number;
};

export type AdminRecurringSeriesListResult =
  | { ok: true; summary: AdminRecurringSeriesSummary; series: AdminRecurringSeriesListItem[] }
  | { ok: false; code: "PERSISTENCE_ERROR"; message: string; status: number };

export type AdminRecurringSeriesDetailResult =
  | { ok: true; series: AdminRecurringSeriesDetail }
  | { ok: false; code: "NOT_FOUND" | "PERSISTENCE_ERROR"; message: string; status: number };

export type CustomerRecurringEmptyReason = "none_for_account";

export type CustomerRecurringSeriesListResult =
  | {
      ok: true;
      series: CustomerRecurringSeriesListItem[];
      /** Set when the query succeeded but this account owns no series rows. */
      emptyReason?: CustomerRecurringEmptyReason;
    }
  | { ok: false; code: "PROVISIONING_INCOMPLETE" | "PERSISTENCE_ERROR"; message: string; status: number };

export type CustomerRecurringSeriesDetailResult =
  | { ok: true; series: CustomerRecurringSeriesDetail }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "PROVISIONING_INCOMPLETE" | "PERSISTENCE_ERROR"; message: string; status: number };
