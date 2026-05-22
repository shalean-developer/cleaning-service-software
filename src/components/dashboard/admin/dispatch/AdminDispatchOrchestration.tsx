import Link from "next/link";
import type { AdminDispatchOrchestrationData } from "@/features/dashboards/server/adminDispatchOrchestrationReadModel";
import { AdminDispatchOrchestrationHero } from "@/components/dashboard/admin/dispatch/AdminDispatchOrchestrationHero";
import { AdminDispatchSummaryCards } from "@/components/dashboard/admin/dispatch/AdminDispatchSummaryCards";
import { AdminDispatchActiveAlerts } from "@/components/dashboard/admin/dispatch/AdminDispatchActiveAlerts";
import { AdminDispatchLaneSection } from "@/components/dashboard/admin/dispatch/AdminDispatchLaneSection";
import { AdminDispatchSuggestedMatches } from "@/components/dashboard/admin/dispatch/AdminDispatchSuggestedMatches";
import {
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_PANEL_HEADER_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";

type Props = {
  data: AdminDispatchOrchestrationData;
};

export function AdminDispatchOrchestration({ data }: Props) {
  return (
    <div className="space-y-6 sm:space-y-8" aria-label="Dispatch orchestration">
      <AdminDispatchOrchestrationHero summary={data.summary} />

      <AdminDispatchSummaryCards summary={data.summary} />

      <AdminDispatchActiveAlerts alerts={data.alerts} />

      <section className="space-y-8">
        {data.lanes.map((lane) => (
          <AdminDispatchLaneSection key={lane.id} lane={lane} />
        ))}
      </section>

      <AdminDispatchSuggestedMatches match={data.suggestedMatch} />

      {data.workQueue.length > 0 ? (
        <section className={ADMIN_OVERVIEW_PANEL_CLASS} aria-label="Assignment work queue">
          <header className={ADMIN_OVERVIEW_PANEL_HEADER_CLASS}>
            <div className="space-y-1">
              <h2 className={ADMIN_OVERVIEW_SERIF_TITLE_CLASS}>Work queue</h2>
              <p className="text-sm text-slate-500">
                {data.workQueue.length} booking{data.workQueue.length === 1 ? "" : "s"} needing dispatch
                attention beyond today&apos;s lanes.
              </p>
            </div>
          </header>
          <ul className="divide-y divide-slate-100">
            {data.workQueue.slice(0, 6).map((item) => (
              <li key={item.bookingId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{item.serviceLabel}</p>
                  <p className="truncate text-sm text-slate-600">{item.scheduleLabel}</p>
                </div>
                <Link
                  href={`/admin/bookings/${item.bookingId}`}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                >
                  Open booking
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
