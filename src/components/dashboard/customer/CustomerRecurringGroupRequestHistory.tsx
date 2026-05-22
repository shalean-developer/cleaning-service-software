import type { CustomerRecurringGroupRequestItem } from "@/features/recurring/server/recurringManagementTypes";
import { CustomerSupportRequestTimeline } from "@/components/dashboard/customer/CustomerSupportRequestTimeline";

type Props = {
  open: CustomerRecurringGroupRequestItem[];
  acknowledged: CustomerRecurringGroupRequestItem[];
  resolved: CustomerRecurringGroupRequestItem[];
  rejected?: CustomerRecurringGroupRequestItem[];
  contactHref?: string;
};

function mapItem(req: CustomerRecurringGroupRequestItem) {
  return {
    id: req.id,
    requestType: req.requestType,
    requestTypeLabel: `${req.requestTypeLabel} · ${req.scopeLabel}${
      req.targetWeekdayLabel ? ` · ${req.targetWeekdayLabel}` : ""
    }`,
    status: req.status,
    statusLabel: req.statusLabel,
    message: req.note,
    preferredNewTime: req.requestedDateTimeIso,
    customerResponse: req.customerResponse,
    createdAt: req.createdAt,
    statusChangedAt: req.statusChangedAt,
    resolvedAt: req.resolvedAt,
  };
}

export function CustomerRecurringGroupRequestHistory({
  open,
  acknowledged,
  resolved,
  rejected = [],
  contactHref = "/contact",
}: Props) {
  const all = [...open, ...acknowledged, ...resolved, ...rejected].map(mapItem);
  if (all.length === 0) {
    return <p className="text-sm text-zinc-600">No requests yet for this schedule.</p>;
  }
  return <CustomerSupportRequestTimeline requests={all} contactHref={contactHref} />;
}
