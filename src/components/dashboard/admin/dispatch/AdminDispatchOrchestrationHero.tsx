import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import type { DispatchOrchestrationSummary } from "@/features/dashboards/adminDispatchOrchestrationDisplay";

type Props = {
  summary: DispatchOrchestrationSummary;
};

export function AdminDispatchOrchestrationHero({ summary }: Props) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Dispatch</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>Orchestration</h1>
        <p className={`max-w-2xl ${ADMIN_OVERVIEW_MUTED_CLASS}`}>
          Assignments, conflicts, and matching across today&apos;s lanes.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
          {summary.slotsToday} slots
        </span>
        {summary.pending > 0 ? (
          <span className="inline-flex items-center rounded-full border border-amber-200/90 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 shadow-sm">
            {summary.pending} pending
          </span>
        ) : null}
      </div>
    </header>
  );
}
