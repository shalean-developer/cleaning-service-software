/** RC-5A — shared loading, fetch-error, and empty-state copy (presentation only). */

export const DASHBOARD_LOADING_SR_LABEL = "Loading…" as const;

export const WIZARD_NAV_LOADING_LABEL = "One moment…" as const;

export const WIZARD_LOADING_CLEANERS_LABEL = "Finding cleaners…" as const;

export const ADMIN_LOADING_ELIGIBLE_CLEANERS_LABEL = "Finding eligible cleaners…" as const;

export const PAYMENT_VERIFY_STATUS_MESSAGE = "Confirming your payment…" as const;

export const LIFECYCLE_GUIDANCE_PANEL_TITLE = "What happens next" as const;

export const LIFECYCLE_EMPTY_TIMELINE_LABEL = "No activity recorded yet." as const;

export const LIFECYCLE_EMPTY_TIMELINE_HINT =
  "Activity will appear here after payment or assignment updates." as const;

export type DashboardFetchResource =
  | "bookings"
  | "offers"
  | "jobs"
  | "earnings"
  | "payouts";

export type DashboardFetchAudience = "customer" | "cleaner" | "admin";

const FETCH_RESOURCE_PHRASE: Record<
  DashboardFetchResource,
  Record<DashboardFetchAudience, string>
> = {
  bookings: {
    customer: "your bookings",
    cleaner: "bookings",
    admin: "bookings",
  },
  offers: {
    customer: "offers",
    cleaner: "offers",
    admin: "offers",
  },
  jobs: {
    customer: "jobs",
    cleaner: "jobs",
    admin: "jobs",
  },
  earnings: {
    customer: "earnings",
    cleaner: "earnings",
    admin: "earnings",
  },
  payouts: {
    customer: "payouts",
    cleaner: "payouts",
    admin: "payouts",
  },
};

/** Calm fetch-error title for dashboard surfaces (distinct from empty states). */
export function dashboardFetchErrorTitle(
  resource: DashboardFetchResource,
  audience: DashboardFetchAudience,
): string {
  return `Couldn't load ${FETCH_RESOURCE_PHRASE[resource][audience]}`;
}

/** List-card helper when payment is incomplete (customer bookings list). */
export const CUSTOMER_PAYMENT_INCOMPLETE_LIST_HELPER =
  "Payment incomplete — complete checkout to assign a cleaner." as const;

export function customerBookingPaymentLineClass(tone: "muted" | "attention"): string {
  return tone === "attention"
    ? "text-sm text-amber-900/90"
    : "text-sm text-zinc-500";
}

/** Non-payment admin action feedback (calmer than destructive red). */
export const ADMIN_ACTION_ERROR_CLASS = "text-sm text-amber-950" as const;
