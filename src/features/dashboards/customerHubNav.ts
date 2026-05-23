import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";

const HUB_ICON_BY_HREF = {
  "/customer": "home",
  "/customer/bookings": "bookings",
  "/customer/bookings/recurring": "recurring",
  "/customer/payment-methods": "payment-methods",
  "/customer/payments": "payments",
  "/customer/invoices": "payments",
  "/customer/book": "book",
} as const satisfies Record<
  (typeof CUSTOMER_DASHBOARD_NAV)[number]["href"],
  "home" | "bookings" | "recurring" | "payment-methods" | "payments" | "book"
>;

/** Customer hub sidebar navigation (same destinations as dashboard top nav). */
export const CUSTOMER_HUB_NAV = CUSTOMER_DASHBOARD_NAV.map((item) => ({
  href: item.href,
  label: item.label,
  icon: HUB_ICON_BY_HREF[item.href],
}));

export type CustomerHubNavIcon = (typeof CUSTOMER_HUB_NAV)[number]["icon"];
