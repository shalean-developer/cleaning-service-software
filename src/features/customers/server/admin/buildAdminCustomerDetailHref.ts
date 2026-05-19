import type { AdminCustomerDetailBookingFilter } from "./parseAdminCustomerDetailQuery";

export function buildAdminCustomerDetailHref(
  customerId: string,
  options?: { bookingFilter?: AdminCustomerDetailBookingFilter },
): string {
  const params = new URLSearchParams();
  const filter = options?.bookingFilter ?? "all";
  if (filter !== "all") {
    params.set("bookingFilter", filter);
  }
  const query = params.toString();
  return query
    ? `/admin/customers/${customerId}?${query}`
    : `/admin/customers/${customerId}`;
}
