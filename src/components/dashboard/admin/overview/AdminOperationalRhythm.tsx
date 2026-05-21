import Link from "next/link";
import {
  ADMIN_OVERVIEW_PANEL_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import type { AdminHomeRhythmMetric } from "@/features/dashboards/adminHomeOperationsDisplay";

type Props = {
  metrics: AdminHomeRhythmMetric[];
  emptyWindowHint?: string;
};

export function AdminOperationalRhythm({ metrics, emptyWindowHint }: Props) {
  return (
    <section className={ADMIN_OVERVIEW_PANEL_CLASS} aria-label="Operational rhythm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="space-y-1">
          <h2 className={ADMIN_OVERVIEW_SERIF_TITLE_CLASS}>Operational rhythm</h2>
          {emptyWindowHint ? (
            <p className="text-xs text-slate-500">{emptyWindowHint}</p>
          ) : null}
        </div>
        <Link
          href="/admin/analytics/team-support"
          className="shrink-0 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          aria-label="Open team support insights"
        >
          Insights →
        </Link>
      </header>
      <ul className="grid list-none grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-5">
        {metrics.map((metric) => (
          <li
            key={metric.id}
            className="rounded-xl border border-slate-200/60 bg-slate-50/40 px-4 py-3.5 transition-colors hover:border-slate-300/80 hover:bg-white"
          >
            <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
              {metric.value}
            </p>
            {metric.hint ? (
              <p className="mt-1 text-xs leading-snug text-slate-500">{metric.hint}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
