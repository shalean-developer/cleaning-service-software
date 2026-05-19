import type { ParsedAdminCustomersQuery } from "./parseAdminCustomersQuery";

export type AdminCustomersListHrefInput = Partial<
  Pick<ParsedAdminCustomersQuery, "q" | "bookings" | "health" | "activity" | "limit">
> & {
  page?: number;
};

/** Builds `/admin/customers` href preserving active filters (omits defaults). */
export function buildAdminCustomersListHref(input: AdminCustomersListHrefInput = {}): string {
  const params = new URLSearchParams();

  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  if (input.limit && input.limit !== 50) {
    params.set("limit", String(input.limit));
  }
  if (input.q) {
    params.set("q", input.q);
  }
  if (input.bookings && input.bookings !== "all") {
    params.set("bookings", input.bookings);
  }
  if (input.health && input.health !== "all") {
    params.set("health", input.health);
  }
  if (input.activity && input.activity !== "all") {
    params.set("activity", input.activity);
  }

  const query = params.toString();
  return query ? `/admin/customers?${query}` : "/admin/customers";
}
