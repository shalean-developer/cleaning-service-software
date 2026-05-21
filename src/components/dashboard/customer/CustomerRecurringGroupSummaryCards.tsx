import type { CustomerRecurringScheduleGroupDetail } from "@/features/recurring/server/recurringManagementTypes";

type Props = { group: CustomerRecurringScheduleGroupDetail };

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

export function CustomerRecurringGroupSummaryCards({ group }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Card label="Active days" value={String(group.activeSeriesCount)} />
      <Card
        label="Payment required"
        value={String(group.unpaidChildVisits)}
      />
      <Card
        label="Next visit"
        value={group.nextUpcomingVisit?.scheduleLabel ?? "To be scheduled"}
      />
      <Card label="Completed visits" value={String(group.completedChildVisits)} />
      <Card label="Open requests" value={String(group.openRequestCount)} />
    </div>
  );
}
