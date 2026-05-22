import Link from "next/link";
import type { DispatchSuggestedMatch } from "@/features/dashboards/adminDispatchOrchestrationDisplay";
import { ADMIN_OVERVIEW_PANEL_CLASS } from "@/components/dashboard/admin/overview/adminOverviewStyles";

type Props = {
  match: DispatchSuggestedMatch;
};

export function AdminDispatchSuggestedMatches({ match }: Props) {
  if (!match) return null;

  return (
    <section
      className={`${ADMIN_OVERVIEW_PANEL_CLASS} flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5`}
      aria-label="Suggested matches"
    >
      <p className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Suggested match</span>
        <span className="text-slate-500"> · </span>
        {match.label}
      </p>
      <Link
        href="/admin/assignments"
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Auto-match queue
      </Link>
    </section>
  );
}
