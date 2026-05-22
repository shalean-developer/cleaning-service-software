import type { AdminEarningsPeriod } from "./adminEarningsDisplay";

export function buildAdminEarningsHref(period?: AdminEarningsPeriod): string {
  if (!period || period === "week") return "/admin/payouts";
  return `/admin/payouts?period=${period}`;
}
