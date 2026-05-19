import { z } from "zod";

export const ADMIN_CUSTOMER_DETAIL_BOOKING_FILTERS = [
  "all",
  "upcoming",
  "pending_payment",
  "failed_payment",
  "completed",
  "cancelled",
] as const;

export type AdminCustomerDetailBookingFilter =
  (typeof ADMIN_CUSTOMER_DETAIL_BOOKING_FILTERS)[number];

const adminCustomerDetailQuerySchema = z.object({
  bookingFilter: z.enum(ADMIN_CUSTOMER_DETAIL_BOOKING_FILTERS).default("all"),
});

export type ParsedAdminCustomerDetailQuery = z.infer<typeof adminCustomerDetailQuerySchema>;

export function parseAdminCustomerDetailQueryParams(
  searchParams: URLSearchParams,
): ParsedAdminCustomerDetailQuery {
  const raw = {
    bookingFilter: searchParams.get("bookingFilter") ?? undefined,
  };
  return adminCustomerDetailQuerySchema.parse(raw);
}
