/** Shared customer dashboard navigation (presentation only). */
export const CUSTOMER_DASHBOARD_NAV = [
  { href: "/customer", label: "Home" },
  { href: "/customer/bookings", label: "Bookings" },
  { href: "/customer/bookings/recurring", label: "Recurring" },
  { href: "/customer/payment-methods", label: "Payment methods" },
  { href: "/customer/payments", label: "Payment history" },
  { href: "/customer/invoices", label: "Monthly invoices" },
  { href: "/customer/book", label: "Book a clean" },
] as const;
