import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";

export type AdminBookingsPresetId =
  | "needs_attention"
  | "payment_issues"
  | "awaiting_payment"
  | "payment_link_sent"
  | "payment_link_expired"
  | "admin_assisted"
  | "paid_via_offline"
  | "paid_via_paystack_link"
  | "paid_no_assignment"
  | "deferred"
  | "team_support"
  | "all";

export type AdminBookingsPreset = {
  id: AdminBookingsPresetId;
  label: string;
  /** Maps to existing `?filter=` query param; omitted for All. */
  filter?: AdminBookingFilter;
};

/** Preset chips for /admin/bookings. each maps to an existing server filter only. */
export const ADMIN_PAYMENT_REQUEST_PRESETS: readonly AdminBookingsPreset[] = [
  { id: "awaiting_payment", label: "Awaiting payment", filter: "awaiting_payment" },
  { id: "payment_link_sent", label: "Payment link sent", filter: "payment_link_sent" },
  { id: "payment_link_expired", label: "Link expired", filter: "payment_link_expired" },
  { id: "admin_assisted", label: "Admin-assisted", filter: "admin_assisted_only" },
  { id: "paid_via_offline", label: "Paid via offline", filter: "paid_via_offline" },
  {
    id: "paid_via_paystack_link",
    label: "Paid via Paystack link",
    filter: "paid_via_paystack_link",
  },
] as const;

export const ADMIN_BOOKINGS_PRESETS: readonly AdminBookingsPreset[] = [
  { id: "needs_attention", label: "Needs attention", filter: "assignment_attention" },
  { id: "payment_issues", label: "Payment issues", filter: "payment_failed" },
  ...ADMIN_PAYMENT_REQUEST_PRESETS,
  { id: "paid_no_assignment", label: "Paid, no assignment", filter: "pending_assignment" },
  { id: "deferred", label: "Deferred", filter: "dispatch_not_started" },
  { id: "team_support", label: "Team support request", filter: "two_cleaner_request" },
  { id: "all", label: "All" },
] as const;

export function adminBookingsPresetForFilter(
  filter: AdminBookingFilter | undefined,
): AdminBookingsPreset | undefined {
  if (!filter) {
    return ADMIN_BOOKINGS_PRESETS.find((p) => p.id === "all");
  }
  return ADMIN_BOOKINGS_PRESETS.find((p) => p.filter === filter);
}

export function isAdminBookingsPresetActive(
  preset: AdminBookingsPreset,
  filter: AdminBookingFilter | undefined,
): boolean {
  if (preset.id === "all") {
    return filter == null;
  }
  return preset.filter === filter;
}
