import Link from "next/link";
import { AlertTriangle, CalendarDays, TrendingUp, Users } from "lucide-react";
import { AdminMetricCard } from "@/components/dashboard/admin/overview/AdminMetricCard";
import {
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import type {
  AdminHomeSnapshotPresentation,
  AdminHomeTodaySnapshot,
} from "@/features/dashboards/adminHomeOperationsDisplay";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";

type Props = {
  snapshot: AdminHomeTodaySnapshot;
  presentation: AdminHomeSnapshotPresentation;
  criticalSignals: number;
};

export function AdminSnapshotCards({
  snapshot,
  presentation,
  criticalSignals,
}: Props) {
  const summaryLine = `${snapshot.bookingsToday} booking${snapshot.bookingsToday === 1 ? "" : "s"} · ${snapshot.cleanersActive} cleaner${snapshot.cleanersActive === 1 ? "" : "s"} on duty${presentation.summarySuffix ?? ""}`;
  const hasIssues = snapshot.activeIssues > 0;

  return (
    <section className={ADMIN_OVERVIEW_SNAPSHOT_SHELL_CLASS} aria-label="Today snapshot">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Today snapshot</p>
          <p className="mt-1 font-serif text-lg font-medium tracking-tight text-slate-900 sm:text-xl">
            {summaryLine}
          </p>
        </div>
        <Link
          href="/admin/assignments"
          aria-label="Open dispatch assignments"
          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Open dispatch →
        </Link>
      </div>

      <ul className="mt-5 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        <li>
          <AdminMetricCard
            label="Bookings today"
            value={String(snapshot.bookingsToday)}
            footer={presentation.bookingsFooter}
            icon={CalendarDays}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Cleaners active"
            value={String(snapshot.cleanersActive)}
            footer={presentation.cleanersFooter}
            icon={Users}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Revenue today"
            value={formatZar(snapshot.revenueTodayCents)}
            footer={presentation.revenueFooter}
            icon={TrendingUp}
          />
        </li>
        <li>
          <AdminMetricCard
            label="Active issues"
            value={String(snapshot.activeIssues)}
            secondary={
              hasIssues && criticalSignals > 0 ? `${criticalSignals} critical` : undefined
            }
            footer={presentation.issuesFooter}
            icon={AlertTriangle}
            emphasize={hasIssues}
          />
        </li>
      </ul>
    </section>
  );
}
