import type { AssignmentOfferStatus, PaymentStatus } from "@/lib/database/types";
import type { PaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { NotificationOutboxStatus } from "@/lib/database/types";
import type { AssignmentVisibilityKey } from "@/features/assignments/server/resolveAssignmentVisibility";
import type { DeferredDispatchStatus } from "@/features/assignments/server/deferredDispatchStatus";
import type {
  AdminAuditEntry,
  AdminOperationalStatus,
  AdminOperationsSummary,
} from "./adminOperationalHelpers";
import type { LifecycleEvent } from "./lifecycleTimeline";
import type { BookingDisplayFields } from "./parseBookingDisplay";
import type {
  AdminAssistPaymentLinkMetadata,
  AdminAssistPaymentRequestState,
} from "@/features/bookings/server/admin/adminAssistPaymentLinkMetadata";
import type { AdminAssistPaidVia } from "@/features/bookings/server/admin/resolveAdminAssistPaidVia";
import type { AdminAssistTimelineEntry } from "@/features/bookings/server/admin/buildAdminBookingAssistTimeline";
import type {
  AdminOperationalLoadSignals,
  TeamRequestFulfillment,
  TeamSupportOps,
} from "./adminTeamSupportObservation";

export type { AdminAuditEntry, AdminOperationalStatus, AdminOperationsSummary };

export type PaymentSummary = {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  provider: string;
  providerRef: string | null;
};

export type OfferSummary = {
  id: string;
  cleanerId: string;
  cleanerName: string | null;
  status: AssignmentOfferStatus;
  offeredAt: string;
  expiresAt: string | null;
  respondedAt: string | null;
};

export type CustomerBookingListItem = {
  id: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  paymentFailureReason: PaymentFailureReason;
  isUpcoming: boolean;
  scheduledStart: string;
  scheduledEnd: string;
  priceCents: number;
  currency: string;
  seriesId: string | null;
  /** True when booking is linked to a materialized recurring series. */
  isSeriesVisit: boolean;
  display: BookingDisplayFields;
  scheduleLabel: string;
  assignedCleanerLabel: string | null;
  /** Shown when assignment is intentionally deferred until closer to service date. */
  deferredAssignmentMessage: string | null;
  updatedAt: string;
};

export type CustomerBookingDetail = CustomerBookingListItem & {
  timeline: LifecycleEvent[];
  payments: PaymentSummary[];
  cleanerPreferenceLabel: string;
  /** Same-booking Paystack retry via payment-retry-lock (detail page only). */
  canRetryPayment: boolean;
  /** Open Paystack checkout for pending_payment (reuses existing pending payment when present). */
  canCompletePayment: boolean;
};

export type CleanerJobTeamContext = import("./cleanerTeamJobVisibility").CleanerJobTeamContext;

export type CleanerOfferListItem = {
  offerId: string;
  bookingId: string;
  status: AssignmentOfferStatus;
  expiresAt: string | null;
  offeredAt: string;
  scheduleLabel: string;
  locationSummary: string;
  serviceLabel: string;
  earningsCents: number | null;
  earningsLabel: string;
  isExpired: boolean;
  /** NF-7E: e.g. "Support cleaner" when team offers enabled. */
  teamRoleLabel: string | null;
};

export type CleanerJobListItem = {
  bookingId: string;
  status: BookingStatus;
  scheduledStart: string;
  scheduledEnd: string;
  scheduleLabel: string;
  locationSummary: string;
  serviceLabel: string;
  earningsCents: number | null;
  earningsLabel: string;
  updatedAt: string;
  teamRoleLabel: string | null;
  isTeamJob: boolean;
};

export type CleanerJobEarningSummary = {
  id: string;
  payoutAmountCents: number;
  payoutStatus: import("@/lib/database/types").EarningPayoutStatus;
  createdAt: string;
};

export type CleanerJobDetail = CleanerJobListItem & {
  timeline: LifecycleEvent[];
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyOperationalLabel: string | null;
  teamSupportCleanerNote: string | null;
  specialInstructions: string | null;
  operationalAccessNotes: string | null;
  earnings: CleanerJobEarningSummary[];
  team: CleanerJobTeamContext;
};

export type AdminBookingObservation = {
  isTwoCleanerRequest: boolean;
  operationalLoad: AdminOperationalLoadSignals;
  teamRequestFulfillment: TeamRequestFulfillment | null;
  teamRequestFulfillmentLabel: string | null;
  teamSupportOps: TeamSupportOps;
  supportingCleanerLabel: string | null;
  coordinationStatusLabel: string | null;
  hasTeamSupportNotes: boolean;
};

export type AdminTeamSupportAnalytics = import("./adminTeamSupportObservation").AdminTeamSupportAnalytics;

export type AdminBookingListItem = {
  id: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  paymentFailureReason: PaymentFailureReason;
  customerLabel: string;
  cleanerLabel: string | null;
  serviceLabel: string;
  scheduleLabel: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  createdAt?: string;
  suburb?: string | null;
  city?: string | null;
  addressLine?: string | null;
  homeSizeSummary?: string | null;
  isRecurring?: boolean;
  priceLabel: string;
  priceCents: number;
  observation: AdminBookingObservation;
  assignmentAttention: string | null;
  assignmentVisibilityKey?: AssignmentVisibilityKey;
  dispatchNotStarted?: boolean;
  recoveryEligible?: boolean;
  deferredDispatch?: DeferredDispatchStatus;
  latestProviderRef?: string | null;
  updatedAt: string;
  /** Admin wizard / assist metadata present on booking. */
  adminAssisted?: boolean;
  /** Derived payment-request visibility for admin-assisted bookings. */
  paymentRequestState?: AdminAssistPaymentRequestState;
  paymentLinkExpiresAt?: string | null;
  /** Settled rail for paid admin-assisted bookings (read-model only). */
  adminAssistPaidVia?: AdminAssistPaidVia | null;
};

export type AdminBookingsListResult = {
  bookings: AdminBookingListItem[];
  /** Exact DB count when only server-side filters apply (6C-1); null when unfiltered or subset-refined. */
  matchTotal: number | null;
  returnedCount: number;
  limit: number;
  capped: boolean;
  /** True when assignment presets or search still filter the loaded cap in memory. */
  subsetFiltered?: boolean;
};

export type AdminEarningSummary = {
  id: string;
  cleanerId: string;
  payoutAmountCents: number;
  grossAmountCents: number;
  payoutStatus: import("@/lib/database/types").EarningPayoutStatus;
  lineType?: string;
  teamEarningRole?: string | null;
  teamEarningSource?: string | null;
};

export type AdminTeamEarningsReconciliation = {
  enabled: boolean;
  splitPolicy: "equal" | null;
  expectedParticipantCount: number;
  expectedShareCents: number | null;
  totalPoolCents: number | null;
  recordedPayoutCents: number;
  status: "disabled" | "ok" | "blocked" | "warnings";
  canMarkPayoutReady: boolean;
  blockingIssues: {
    code: string;
    severity: "error";
    message: string;
  }[];
  warnings: {
    code: string;
    severity: "info" | "warning";
    message: string;
  }[];
  issues: {
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
  }[];
};

export type AdminNotificationOutboxEntry = {
  id: string;
  template: string;
  status: NotificationOutboxStatus;
  channel: string;
  recipientType: "customer" | "cleaner" | "unknown";
  bookingId: string | null;
  offerId: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  /** Display note: sanitized error or dry-run summary. */
  statusNote: string | null;
  isDryRun: boolean;
  dryRun: {
    template: string | null;
    bookingId: string | null;
    offerId: string | null;
    recipientType: string | null;
  } | null;
  isDeliverable: boolean;
  /** Booking detail only. failed deliverable rows eligible for admin requeue (5E-1a). */
  canRequeue: boolean;
  requeueBlockReason?: string;
};

export type AdminOperationalAuditEntry = {
  id: string;
  at: string;
  adminProfileId: string;
  adminLabel: string | null;
  action: string;
  actionLabel: string;
  outcome: string;
  outcomeLabel: string;
  reason: string | null;
  resultCode: string | null;
  cleanerId: string | null;
  offerId: string | null;
  cancelledOfferId: string | null;
  bookingStatusBefore: string | null;
  bookingStatusAfter: string | null;
  idempotencyKey: string | null;
  metadataSummary: string | null;
};

export type TeamRosterFoundationRow = import("./bookingCleanersReadModel").TeamRosterFoundationRow;

export type AdminBookingDetail = AdminBookingListItem & {
  customerId: string;
  /** True when metadata.adminAssist marks an admin wizard draft. */
  adminAssistedDraft: boolean;
  adminAssistPaymentLink: AdminAssistPaymentLinkMetadata | null;
  adminAssistSupersededPaymentLinks: AdminAssistPaymentLinkMetadata[];
  adminAssistPaymentTimeline: AdminAssistTimelineEntry[];
  /** True when customer auth profile has an email (admin payment request email). */
  customerHasEmail: boolean;
  cleanerId: string | null;
  /** NF-7C display-only roster rows when booking_cleaners has data. */
  teamRosterFoundation: TeamRosterFoundationRow[];
  /** Formatted SA mobile for ops (profile or booking snapshot). */
  customerPhone: string | null;
  customerPhoneE164: string | null;
  timeline: LifecycleEvent[];
  payments: PaymentSummary[];
  offers: OfferSummary[];
  earnings: AdminEarningSummary[];
  teamEarningsReconciliation: AdminTeamEarningsReconciliation;
  audits: AdminAuditEntry[];
  operationalAudits: AdminOperationalAuditEntry[];
  paymentEvents: { id: string; eventType: string | null; at: string }[];
  display: BookingDisplayFields;
  operational: AdminOperationalStatus;
  notifications: AdminNotificationOutboxEntry[];
  deletedAt: string | null;
  hasEarningLines: boolean;
  hardDelete: {
    allowed: boolean;
    blockedReasons: string[];
  };
};

export type AdminAssignmentQueueItem = {
  bookingId: string;
  status: BookingStatus;
  customerLabel: string;
  serviceLabel: string;
  scheduleLabel: string;
  assignmentAttention: string;
  assignmentReason: string | null;
  openOffers: OfferSummary[];
  queueReason: string;
  opsSearching: boolean;
  opsAdminRequired: boolean;
  recoveryCronCanHandle: boolean;
  manualInterventionNeeded: boolean;
  runbookKey: import("./adminRunbooks").AdminRunbookKey | null;
  updatedAt: string;
};

export type AdminAssignmentQueueResult = {
  items: AdminAssignmentQueueItem[];
  total: number;
  limit: number;
};
