import type { NavItem } from "@/components/dashboard/DashboardShell";

export type AdminNavGroup = {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
};

/** Primary destination — rendered separately from operational groups. */
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
      { href: "/admin/assignments", label: "Dispatch" },
      { href: "/admin/cleaners", label: "Cleaners" },
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
      { href: "/admin/analytics/assignments", label: "Assignment analytics" },
    ],
  },
] as const;

/** Flat nav list (all routes) for shells and tests that expect a single array. */
export const ADMIN_DASHBOARD_NAV: readonly NavItem[] = [
  ADMIN_DASHBOARD_HOME,
  ...ADMIN_DASHBOARD_NAV_GROUPS.flatMap((group) => group.items),
];

/** Bottom-of-sidebar quick actions (presentation only). */
export const ADMIN_SIDEBAR_QUICK_ACTIONS = [
  { href: "/customer/book", label: "Booking flow", description: "Customer booking wizard" },
  { href: "/admin/assignments", label: "Open dispatch", description: "Assignment workbench" },
  { href: "/admin/customers/new", label: "Quick booking", description: "New customer" },
] as const;
