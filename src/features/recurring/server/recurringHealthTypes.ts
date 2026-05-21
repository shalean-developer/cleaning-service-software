export type RecurringHealthSeverity = "healthy" | "warning" | "critical";

export type RecurringHealthAlertCode =
  | "STALE_NEXT_OCCURRENCE"
  | "OVERDUE_PAYMENT_REQUIRED"
  | "CHILD_MISSING_PRICE"
  | "CHILD_MISSING_CUSTOMER"
  | "UNPAID_CHILD_CLEANER_VISIBLE"
  | "CANCELLED_SERIES_UNPAID_CHILD"
  | "PAUSED_SERIES_NEW_CHILD"
  | "SERIES_MISSING_ANCHOR_ID"
  | "DUPLICATE_OCCURRENCE"
  | "ORPHAN_CHILD"
  | "INVALID_SERIES_STATUS"
  | "INVALID_SERIES_FREQUENCY";

export type RecurringHealthAlert = {
  code: RecurringHealthAlertCode;
  severity: RecurringHealthSeverity;
  message: string;
  seriesId?: string;
  bookingId?: string;
};

export type RecurringHealthSummary = {
  activeSeriesCount: number;
  pausedSeriesCount: number;
  cancelledSeriesCount: number;
  childrenGeneratedNext45Days: number;
  paymentRequiredChildrenCount: number;
  overdueUnpaidChildrenCount: number;
  staleNextOccurrenceCount: number;
  failedGenerationRiskCount: number;
  auditIssuesCount: number;
  overallStatus: RecurringHealthSeverity;
};

export type RecurringSeriesHealthRow = {
  seriesId: string;
  customerId: string;
  frequency: string;
  status: string;
  nextOccurrenceAt: string | null;
  staleNextOccurrence: boolean;
  childCount: number;
  unpaidChildCount: number;
};

export type RecurringGenerationRunSummary = {
  id: string;
  runId: string;
  completedAt: string;
  status: string;
  childrenGenerated: number;
  failuresCount: number;
};

export type RecurringSeriesAuditEvent = {
  seriesId: string;
  anchorBookingId: string;
  action: string;
  actorType: string;
  createdAt: string;
};

export type RecurringHealthReadModel = {
  generatedAt: string;
  summary: RecurringHealthSummary;
  alerts: RecurringHealthAlert[];
  seriesHealth: RecurringSeriesHealthRow[];
  staleOrRiskySeries: RecurringSeriesHealthRow[];
  paymentRequiredBookings: Array<{
    bookingId: string;
    seriesId: string;
    scheduledStart: string;
    status: string;
    ageHours: number;
    overdue: boolean;
  }>;
  latestGenerationRuns: RecurringGenerationRunSummary[];
  recentAuditEvents: RecurringSeriesAuditEvent[];
};
