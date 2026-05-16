import type { AssignmentOfferStatus, PaymentStatus } from "@/lib/database/types";
import type { PaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { LifecycleEvent } from "./lifecycleTimeline";
import type { BookingDisplayFields } from "./parseBookingDisplay";

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
  priceLabel: string;
  assignmentAttention: string | null;
  updatedAt: string;
};

export type AdminEarningSummary = {
  id: string;
  cleanerId: string;
  payoutAmountCents: number;
  grossAmountCents: number;
  payoutStatus: import("@/lib/database/types").EarningPayoutStatus;
};

export type AdminBookingDetail = AdminBookingListItem & {
  customerId: string;
  cleanerId: string | null;
  timeline: LifecycleEvent[];
  payments: PaymentSummary[];
  offers: OfferSummary[];
  earnings: AdminEarningSummary[];
  audits: { id: number; command: string | null; from: string | null; to: string | null; at: string }[];
  paymentEvents: { id: string; eventType: string | null; at: string }[];
  display: BookingDisplayFields;
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
  updatedAt: string;
};
