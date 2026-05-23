export type CustomerPaymentHistoryStatus = "paid" | "pending" | "failed";

export type CustomerPaymentHistorySource =
  | "booking"
  | "zoho_invoice"
  | "saved_card_invoice";

export type CustomerPaymentHistoryItem = {
  id: string;
  source: CustomerPaymentHistorySource;
  title: string;
  reference: string | null;
  invoiceNumber: string | null;
  bookingId: string | null;
  amountCents: number;
  currency: string;
  status: CustomerPaymentHistoryStatus;
  paidAt: string | null;
  createdAt: string;
  paymentMethodLabel: string | null;
  actionUrl: string | null;
};

export type CustomerPaymentHistorySourceFilter =
  | "all"
  | CustomerPaymentHistorySource;

export type CustomerPaymentHistoryStatusFilter = "all" | CustomerPaymentHistoryStatus;

export type LoadCustomerPaymentHistoryInput = {
  profileId: string;
  customerEmail: string;
  actingCustomerId: string | null;
  source?: CustomerPaymentHistorySourceFilter;
  status?: CustomerPaymentHistoryStatusFilter;
  limit?: number;
  cursor?: string | null;
};

export type LoadCustomerPaymentHistoryResult = {
  items: CustomerPaymentHistoryItem[];
  nextCursor: string | null;
};

export const CUSTOMER_PAYMENT_HISTORY_DEFAULT_LIMIT = 20;
export const CUSTOMER_PAYMENT_HISTORY_MAX_LIMIT = 50;
export const CUSTOMER_PAYMENT_HISTORY_FETCH_CAP = 100;
