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

export type RecurringSeriesRequestType =
  | "pause"
  | "cancel"
  | "reschedule"
  | "pause_group"
  | "cancel_group"
  | "reschedule_group"
  | "pause_weekday"
  | "cancel_weekday"
  | "reschedule_weekday";

export type RecurringSeriesRequestScope = "series" | "group";

export type RecurringSeriesRequestBadge = {
  id: string;
  requestType: RecurringSeriesRequestType;
  requestTypeLabel: string;
  scope: RecurringSeriesRequestScope;
  scopeLabel: string;
  status: "open" | "acknowledged" | "resolved";
  statusLabel: string;
  createdAt: string;
  note: string | null;
  targetWeekday: number | null;
  targetWeekdayLabel: string | null;
  requestedDateTimeIso: string | null;
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
  hasOverdueUnpaidChild: boolean;
  openSupportRequest: RecurringSeriesRequestBadge | null;
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
  overdueUnpaid?: boolean;
  openRequests?: boolean;
  nextSevenDays?: boolean;
  search?: string;
};

export type AdminRecurringSeriesSummary = {
  activeCount: number;
  pausedCount: number;
  paymentRequiredChildrenCount: number;
  overdueUnpaidChildrenCount: number;
  openSupportRequestsCount: number;
  nextSevenDaysCount: number;
};

export type AdminRecurringScheduleGroupListItem = {
  groupId: string;
  frequency: "weekly" | "biweekly";
  frequencyLabel: string;
  status: BookingSeriesStatus;
  statusLabel: string;
  serviceLabel: string;
  selectedDaysLabel: string;
  activeSeriesCount: number;
  totalUnpaidChildren: number;
  openCustomerRequestsCount: number;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  suburb: string | null;
  addressSummary: string;
  series: AdminRecurringSeriesListItem[];
};

export type RecurringScheduleGroupActionsAllowed = {
  canPause: boolean;
  canResume: boolean;
  canCancelGroup: boolean;
};

export type AdminRecurringGroupWeekdaySeriesItem = AdminRecurringSeriesListItem & {
  weekday: number | null;
  weekdayLabel: string;
  slotLabel: string | null;
  unpaidChildCount: number;
  paidChildCount: number;
  completedChildCount: number;
  nextPaymentRequiredChildBookingId: string | null;
};

export type AdminRecurringGroupTimelineEntry = {
  bookingId: string;
  seriesId: string;
  scheduledStart: string;
  scheduledEnd: string;
  weekdayLabel: string;
  status: BookingStatus;
  paymentStatus: string | null;
  priceCents: number | null;
  priceLabel: string;
  cleanerLabel: string | null;
  customerStatusLabel: string;
  paymentRequired: boolean;
  scheduleLabel: string;
  paymentLabel: string;
  adminBookingHref: string;
};

export type AdminRecurringGroupSupportRequestItem = RecurringSeriesRequestBadge & {
  seriesId: string | null;
  groupId: string | null;
  weekdayLabel: string;
  resolvedAt: string | null;
};

export type CustomerRecurringGroupActionsAllowed = {
  canRequestPauseGroup: boolean;
  canRequestCancelGroup: boolean;
  canRequestRescheduleGroup: boolean;
  canRequestPauseWeekday: boolean;
  canRequestCancelWeekday: boolean;
  canRequestRescheduleWeekday: boolean;
};

export type CustomerRecurringGroupWeekdaySeriesItem = {
  seriesId: string;
  weekday: number | null;
  weekdayLabel: string;
  slotLabel: string | null;
  status: BookingSeriesStatus;
  statusLabel: string;
  nextOccurrenceAt: string | null;
  nextOccurrenceScheduleLabel: string | null;
  nextOccurrencePaymentRequired: boolean;
  nextOccurrenceBookingId: string | null;
  unpaidChildCount: number;
  completedChildCount: number;
  latestVisitScheduleLabel: string | null;
  seriesDetailHref: string;
};

export type CustomerRecurringGroupVisitEntry = {
  bookingId: string;
  seriesId: string;
  weekdayLabel: string;
  serviceLabel: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduleLabel: string;
  status: BookingStatus;
  paymentLabel: string;
  priceLabel: string;
  paymentRequired: boolean;
  bookingDetailHref: string;
};

export type CustomerRecurringGroupRequestItem = RecurringSeriesRequestBadge & {
  seriesId: string | null;
  resolvedAt: string | null;
};

export type CustomerRecurringScheduleGroupDetail = {
  groupId: string;
  serviceLabel: string;
  frequencyLabel: string;
  status: BookingSeriesStatus;
  statusLabel: string;
  selectedDays: number[];
  selectedDaysLabel: string;
  subtitleLabel: string;
  timezone: string;
  label: string | null;
  createdAt: string;
  sharedTimeLabel: string | null;
  suburb: string | null;
  addressSummary: string;
  activeSeriesCount: number;
  pausedSeriesCount: number;
  cancelledSeriesCount: number;
  totalChildVisits: number;
  unpaidChildVisits: number;
  paidChildVisits: number;
  completedChildVisits: number;
  openRequestCount: number;
  nextUpcomingVisit: { bookingId: string; scheduleLabel: string; weekdayLabel: string } | null;
  nextPaymentRequiredVisit: {
    bookingId: string;
    scheduleLabel: string;
    weekdayLabel: string;
  } | null;
  weekdaySeries: CustomerRecurringGroupWeekdaySeriesItem[];
  upcomingVisits: CustomerRecurringGroupVisitEntry[];
  completedVisits: CustomerRecurringGroupVisitEntry[];
  supportRequests: {
    open: CustomerRecurringGroupRequestItem[];
    acknowledged: CustomerRecurringGroupRequestItem[];
    resolved: CustomerRecurringGroupRequestItem[];
  };
  actions: CustomerRecurringGroupActionsAllowed;
};

export type CustomerRecurringScheduleGroupDetailResult =
  | { ok: true; group: CustomerRecurringScheduleGroupDetail }
  | {
      ok: false;
      code: "NOT_FOUND" | "FORBIDDEN" | "PROVISIONING_INCOMPLETE" | "PERSISTENCE_ERROR";
      message: string;
      status: number;
    };

export type AdminRecurringScheduleGroupDetail = {
  groupId: string;
  label: string | null;
  titleLabel: string;
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceSlug: string;
  serviceLabel: string;
  frequency: "weekly" | "biweekly";
  frequencyLabel: string;
  status: BookingSeriesStatus;
  statusLabel: string;
  selectedDays: number[];
  selectedDaysLabel: string;
  timezone: string;
  suburb: string | null;
  addressSummary: string;
  anchorBookingId: string;
  createdAt: string;
  activeSeriesCount: number;
  pausedSeriesCount: number;
  cancelledSeriesCount: number;
  totalChildVisits: number;
  unpaidChildVisits: number;
  paidChildVisits: number;
  completedChildVisits: number;
  nextUpcomingVisit: { bookingId: string; scheduleLabel: string } | null;
  overdueUnpaidCount: number;
  openCustomerRequestsCount: number;
  weekdaySeries: AdminRecurringGroupWeekdaySeriesItem[];
  timeline: AdminRecurringGroupTimelineEntry[];
  supportRequests: {
    open: AdminRecurringGroupSupportRequestItem[];
    acknowledged: AdminRecurringGroupSupportRequestItem[];
    resolved: AdminRecurringGroupSupportRequestItem[];
  };
  groupAuditNotes: string[];
  actions: RecurringScheduleGroupActionsAllowed;
};

export type AdminRecurringScheduleGroupDetailResult =
  | { ok: true; group: AdminRecurringScheduleGroupDetail }
  | { ok: false; code: "NOT_FOUND" | "PERSISTENCE_ERROR"; message: string; status: number };

export type AdminRecurringSeriesListResult =
  | {
      ok: true;
      summary: AdminRecurringSeriesSummary;
      groups: AdminRecurringScheduleGroupListItem[];
      standaloneSeries: AdminRecurringSeriesListItem[];
      /** @deprecated Use groups + standaloneSeries */
      series: AdminRecurringSeriesListItem[];
    }
  | { ok: false; code: "PERSISTENCE_ERROR"; message: string; status: number };

export type AdminRecurringSeriesDetailResult =
  | { ok: true; series: AdminRecurringSeriesDetail }
  | { ok: false; code: "NOT_FOUND" | "PERSISTENCE_ERROR"; message: string; status: number };

export type CustomerRecurringEmptyReason = "none_for_account";

export type CustomerRecurringScheduleGroupListItem = {
  groupId: string;
  frequencyLabel: string;
  statusLabel: string;
  serviceLabel: string;
  selectedDaysLabel: string;
  nextVisitsSummary: string;
  unpaidUpcomingCount: number;
  series: CustomerRecurringSeriesListItem[];
};

export type CustomerRecurringSeriesListResult =
  | {
      ok: true;
      groups: CustomerRecurringScheduleGroupListItem[];
      standaloneSeries: CustomerRecurringSeriesListItem[];
      /** @deprecated Use groups + standaloneSeries */
      series: CustomerRecurringSeriesListItem[];
      /** Set when the query succeeded but this account owns no series rows. */
      emptyReason?: CustomerRecurringEmptyReason;
    }
  | { ok: false; code: "PROVISIONING_INCOMPLETE" | "PERSISTENCE_ERROR"; message: string; status: number };

export type CustomerRecurringSeriesDetailResult =
  | { ok: true; series: CustomerRecurringSeriesDetail }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "PROVISIONING_INCOMPLETE" | "PERSISTENCE_ERROR"; message: string; status: number };
