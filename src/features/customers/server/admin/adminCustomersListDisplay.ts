import type { ParsedAdminCustomersQuery } from "./parseAdminCustomersQuery";
import type { AdminCustomerLatestBooking, AdminCustomerListItem } from "./types";

export function formatAdminCustomerLastActivity(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatAdminCustomerLatestBooking(
  latestBooking: AdminCustomerLatestBooking | null,
): string {
  if (!latestBooking) return "No bookings yet";
  const date = new Date(latestBooking.scheduledStart).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const service = latestBooking.serviceLabel?.trim();
  const servicePart = service ? `${service} · ` : "";
  return `${servicePart}${latestBooking.status} · ${date}`;
}

export function adminCustomersEmptyState(query: ParsedAdminCustomersQuery): {
  title: string;
  description: string;
} {
  const hasFilters =
    Boolean(query.q) ||
    query.bookings !== "all" ||
    query.health !== "all" ||
    query.activity !== "all";

  if (!hasFilters) {
    return {
      title: "No customers yet",
      description: "Create a customer to start building your directory.",
    };
  }

  const parts: string[] = [];
  if (query.q) parts.push(`search “${query.q}”`);
  if (query.bookings === "has_bookings") parts.push("customers with bookings");
  if (query.bookings === "no_bookings") parts.push("customers without bookings");
  if (query.health === "healthy") parts.push("healthy domain status");
  if (query.health === "needs_attention") parts.push("domain issues");
  if (query.activity === "created_last_7_days") parts.push("created in the last 7 days");
  if (query.activity === "created_last_30_days") parts.push("created in the last 30 days");
  if (query.activity === "active_last_30_days") parts.push("active in the last 30 days");

  return {
    title: "No customers match your filters",
    description: `Try adjusting ${parts.join(", ")} or clearing filters to see more results.`,
  };
}

export function adminCustomersFilterSummary(query: ParsedAdminCustomersQuery): string {
  const parts: string[] = [];
  if (query.q) parts.push(`matching “${query.q}”`);
  if (query.bookings === "has_bookings") parts.push("with bookings");
  if (query.bookings === "no_bookings") parts.push("without bookings");
  if (query.health === "healthy") parts.push("healthy");
  if (query.health === "needs_attention") parts.push("needs attention");
  if (query.activity === "created_last_7_days") parts.push("created ≤7d");
  if (query.activity === "created_last_30_days") parts.push("created ≤30d");
  if (query.activity === "active_last_30_days") parts.push("active ≤30d");
  return parts.length > 0 ? ` ${parts.join(" · ")}` : "";
}
