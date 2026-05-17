import type { AssignmentOfferStatus, PaymentStatus } from "@/lib/database/types";
import type { PaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { NotificationOutboxStatus } from "@/lib/database/types";
import type { AssignmentVisibilityKey } from "@/features/assignments/server/resolveAssignmentVisibility";
import type {
  AdminAuditEntry,
  AdminOperationalStatus,
  AdminOperationsSummary,
} from "./adminOperationalHelpers";
import type { LifecycleEvent } from "./lifecycleTimeline";
import type { BookingDisplayFields } from "./parseBookingDisplay";

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
  display: BookingDisplayFields;
  scheduleLabel: string;
  assignedCleanerLabel: string | null;
  updatedAt: string;
};

export type CustomerBookingDetail = CustomerBookingListItem & {
  timeline: LifecycleEvent[];
  payments: PaymentSummary[];
  cleanerPreferenceLabel: string;
  /** Same-booking Paystack retry via payment-retry-lock (detail page only). */
  canRetryPayment: boolean;
};

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
};

export type CleanerJobEarningSummary = {
  id: string;
  payoutAmountCents: number;
  payoutStatus: import("@/lib/database/types").EarningPayoutStatus;
  createdAt: string;
};

export type CleanerJobDetail = CleanerJobListItem & {
  timeline: LifecycleEvent[];
  specialInstructions: string | null;
  earnings: CleanerJobEarningSummary[];
};

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
  priceLabel: string;
  assignmentAttention: string | null;
  assignmentVisibilityKey?: AssignmentVisibilityKey;
  dispatchNotStarted?: boolean;
  recoveryEligible?: boolean;
  updatedAt: string;
};

export type AdminBookingsListResult = {
  bookings: AdminBookingListItem[];
  total: number;
  limit: number;
};

export type AdminEarningSummary = {
  id: string;
  cleanerId: string;
  payoutAmountCents: number;
  grossAmountCents: number;
  payoutStatus: import("@/lib/database/types").EarningPayoutStatus;
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
  /** Booking detail only — failed deliverable rows eligible for admin requeue (5E-1a). */
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

export type AdminBookingDetail = AdminBookingListItem & {
  customerId: string;
  cleanerId: string | null;
  timeline: LifecycleEvent[];
  payments: PaymentSummary[];
  offers: OfferSummary[];
  earnings: AdminEarningSummary[];
  audits: AdminAuditEntry[];
  operationalAudits: AdminOperationalAuditEntry[];
  paymentEvents: { id: string; eventType: string | null; at: string }[];
  display: BookingDisplayFields;
  operational: AdminOperationalStatus;
  notifications: AdminNotificationOutboxEntry[];
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
