import type { NavItem } from "@/components/dashboard/DashboardShell";

export type AdminNavGroup = {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
};

/** Primary destination. rendered separately from operational groups. */
export const ADMIN_DASHBOARD_HOME: NavItem = {
  href: "/admin",
  label: "Overview",
};

export const ADMIN_DASHBOARD_NAV_GROUPS: readonly AdminNavGroup[] = [
  {
    id: "operate",
    label: "Operate",
    items: [
      { href: "/admin/bookings", label: "Bookings" },
      { href: "/admin/support", label: "Support" },
      { href: "/admin/recurring", label: "Recurring" },
      { href: "/admin/assignments", label: "Dispatch" },
      { href: "/admin/cleaners", label: "Cleaners" },
      { href: "/admin/cleaners/onboarding-leads", label: "Onboarding leads" },
      { href: "/admin/cleaner-applications", label: "Applications" },
      { href: "/admin/customers", label: "Customers" },
    ],
  },
  {
    id: "insight",
    label: "Insight & control",
    items: [
      { href: "/admin/payouts", label: "Earnings" },
      { href: "/admin/analytics/team-support", label: "Insights" },
      { href: "/admin/notifications", label: "Messages" },
      { href: "/admin/operations/zoho-payments", label: "Zoho payments" },
      { href: "/admin/operations/zoho-sales-sync", label: "Zoho sales sync" },
      { href: "/admin/operations/zoho-refunds", label: "Zoho refunds" },
      { href: "/admin/operations/finance-reconciliation", label: "Finance reconciliation" },
      { href: "/admin/operations/accounting-close", label: "Accounting close" },
      { href: "/admin/operations/tax-reports", label: "VAT / tax reports" },
      { href: "/admin/operations/corporate-statements", label: "Corporate statements" },
      { href: "/admin/operations/finance-analytics", label: "Finance analytics" },
      { href: "/admin/operations/production-rollout", label: "Production rollout" },
      { href: "/admin/operations/admin-assisted-bookings", label: "Admin-assisted bookings" },
      { href: "/admin/operations/admin-assisted-production", label: "Admin-assisted production" },
      { href: "/admin/operations/admin-assisted-pilot", label: "Admin-assisted pilot QA" },
      { href: "/admin/operations/zoho-replacement-audit", label: "Zoho replacement audit" },
      { href: "/admin/analytics/assignments", label: "Assignment analytics" },
    ],
  },
] as const;

/** Flat nav list (all routes) for shells and tests that expect a single array. */
export const ADMIN_DASHBOARD_NAV: readonly NavItem[] = [
  ADMIN_DASHBOARD_HOME,
  ...ADMIN_DASHBOARD_NAV_GROUPS.flatMap((group) => group.items),
];

/** Admin-assisted booking wizard (draft creation on behalf of customer). */
export const ADMIN_BOOKING_CREATE_PATH = "/admin/bookings/create";

/** Bottom-of-sidebar quick actions (presentation only). */
export const ADMIN_SIDEBAR_QUICK_ACTIONS = [
  {
    href: ADMIN_BOOKING_CREATE_PATH,
    label: "Create booking",
    description: "Admin-assisted booking wizard",
  },
  {
    href: "/customer/book",
    label: "Customer booking flow",
    description: "Customer self-service booking wizard",
  },
  { href: "/admin/assignments", label: "Open dispatch", description: "Assignment workbench" },
  { href: "/admin/customers/new", label: "New customer", description: "Register a new customer" },
] as const;

/** Compact utility links for the sidebar footer (navigation-adjacent, not primary CTAs). */
export const ADMIN_SIDEBAR_UTILITY_LINKS = [
  {
    href: "/customer/book",
    label: "Customer booking flow",
    description: "Customer self-service booking wizard",
  },
] as const;

/** @deprecated Primary create booking lives on /admin/bookings header — not the sidebar footer. */
export const ADMIN_SIDEBAR_FOOTER_QUICK_ACTIONS = ADMIN_SIDEBAR_UTILITY_LINKS;
