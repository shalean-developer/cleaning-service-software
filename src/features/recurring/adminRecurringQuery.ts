import type { AdminRecurringListQuery } from "./server/recurringManagementTypes";

export type { AdminRecurringListQuery };

export function parseAdminRecurringListQuery(
  params: Record<string, string | undefined>,
): AdminRecurringListQuery {
  const status = params.status;
  const frequency = params.frequency;
  return {
    status:
      status === "active" || status === "paused" || status === "cancelled"
        ? status
        : undefined,
    frequency:
      frequency === "weekly" || frequency === "biweekly" || frequency === "monthly"
        ? frequency
        : undefined,
    paymentRequired: params.payment === "required",
    overdueUnpaid: params.overdue === "1",
    openRequests: params.requests === "open",
    nextSevenDays: params.next7 === "1",
    search: params.q?.trim() || undefined,
  };
}

export function buildAdminRecurringHref(query: AdminRecurringListQuery): string {
  const sp = new URLSearchParams();
  if (query.status) sp.set("status", query.status);
  if (query.frequency) sp.set("frequency", query.frequency);
  if (query.paymentRequired) sp.set("payment", "required");
  if (query.overdueUnpaid) sp.set("overdue", "1");
  if (query.openRequests) sp.set("requests", "open");
  if (query.nextSevenDays) sp.set("next7", "1");
  if (query.search) sp.set("q", query.search);
  const qs = sp.toString();
  return qs ? `/admin/recurring?${qs}` : "/admin/recurring";
}
