import type { PaymentStatus, UserRole } from "@/lib/database/types";
import type { Json } from "@/lib/database/types";
import type {
  CustomerDomainHealthCode,
  CustomerDomainHealthStatus,
} from "./customerDomainHealth";

export type AdminCustomerLatestBooking = {
  id: string;
  status: string;
  scheduledStart: string;
  createdAt: string;
  serviceLabel: string | null;
};

export type AdminCustomerPaymentSummary = {
  totalPayments: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
  totalPaidCents: number;
};

export type AdminCustomerLifecycleSummary = {
  totalBookings: number;
  draftCount: number;
  confirmedCount: number;
  completedCount: number;
  cancelledCount: number;
  otherCount: number;
};

export type AdminCustomerListItem = {
  customerId: string;
  profileId: string;
  companyName: string;
  authEmail: string | null;
  phone: string | null;
  notes: string | null;
  profileRole: UserRole | null;
  bookingCount: number;
  recurringCount: number;
  latestBooking: AdminCustomerLatestBooking | null;
  lastActivityAt: string;
  areaLabel: string | null;
  lifetimeValueCents: number;
  lastVisitAt: string | null;
  preferredCleanerId: string | null;
  preferredCleanerLabel: string | null;
  domainHealth: CustomerDomainHealthStatus;
  provisioningHealthy: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomersListResult = {
  items: AdminCustomerListItem[];
  page: number;
  limit: number;
  matchTotal: number;
  returnedCount: number;
  capped: boolean;
};

export type AdminCustomerBookingHistoryItem = {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  priceCents: number;
  currency: string;
  isRecurring: boolean;
  frequencyLabel: string | null;
  serviceLabel: string | null;
  seriesId: string | null;
  createdAt: string;
  paymentStatus: PaymentStatus | null;
  assignedCleanerLabel: string | null;
  bookingReference: string;
};

export type AdminCustomerBookingOperationsSummary = {
  activeCount: number;
  upcomingCount: number;
  pendingPaymentCount: number;
  failedPaymentCount: number;
  completedCount: number;
  latestBookingId: string | null;
  nextScheduledBookingId: string | null;
};

export type AdminCustomerPaymentSupportSummary = {
  totalPaidCents: number;
  pendingPaymentCount: number;
  failedPaymentCount: number;
  latestPaymentAttemptAt: string | null;
  latestPaymentMethod: string | null;
  latestPaymentBookingId: string | null;
  latestPaymentStatus: PaymentStatus | null;
};

export type AdminCustomerPaymentHistoryItem = {
  id: string;
  bookingId: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  createdAt: string;
  metadata: Json | null;
};

export type AdminCustomerDetail = {
  customerId: string;
  profileId: string;
  companyName: string;
  authEmail: string | null;
  phone: string | null;
  notes: string | null;
  profileFullName: string | null;
  profileRole: UserRole | null;
  hasCleanersRow: boolean;
  bookingCount: number;
  recurringCount: number;
  latestBooking: AdminCustomerLatestBooking | null;
  paymentSummary: AdminCustomerPaymentSummary;
  lifecycleSummary: AdminCustomerLifecycleSummary;
  domainHealth: CustomerDomainHealthStatus;
  provisioningHealthy: boolean;
  bookings: AdminCustomerBookingHistoryItem[];
  recurringBookings: AdminCustomerBookingHistoryItem[];
  payments: AdminCustomerPaymentHistoryItem[];
  bookingOperations: AdminCustomerBookingOperationsSummary;
  paymentSupport: AdminCustomerPaymentSupportSummary;
  profileCreatedAt: string | null;
  customerCreatedAt: string;
  customerUpdatedAt: string;
};

export type AdminCustomersQuery = {
  page: number;
  limit: number;
  q?: string;
  bookings?: "all" | "has_bookings" | "no_bookings";
  health?: "all" | "healthy" | "needs_attention";
  activity?:
    | "all"
    | "created_last_7_days"
    | "created_last_30_days"
    | "active_last_30_days";
};
