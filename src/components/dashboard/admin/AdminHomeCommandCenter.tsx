import Link from "next/link";
import { AdminCronHealthCriticalBanner } from "@/components/dashboard/AdminCronHealthPanel";
import { AdminOperationalQueueStrip } from "@/components/dashboard/AdminOperationalQueueStrip";
import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import type { CronHealthSummary } from "@/features/dashboards/adminAssignmentsPageDisplay";
import {
  adminHomeHealthTileClass,
  buildAdminHomeHealthTiles,
  type AdminHomeHealthTile,
} from "@/features/dashboards/adminHomeDisplay";
import {
  ADMIN_DETAILS_BODY_CLASS,
  ADMIN_DETAILS_DISCLOSURE_CLASS,
  ADMIN_DETAILS_SUMMARY_CLASS,
} from "@/features/dashboards/adminDisplay";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";

type Props = {
  queues: AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  criticalCronJobs: CronJobHealthSnapshot[];
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
  assignmentWorkQueueTotal: number;
  payoutQueueCount: number | null;
};

function HealthTile({ tile }: { tile: AdminHomeHealthTile }) {
  return (
    <Link
      href={tile.href}
      className={adminHomeHealthTileClass(tile.tone, Boolean(tile.emphasize))}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-600">
        {tile.label}
      </span>
      <span className="mt-0.5 text-xl font-semibold tabular-nums leading-tight text-zinc-900">
        {tile.value}
      </span>
      {tile.subtitle ? (
        <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-600">
          {tile.subtitle}
        </span>
      ) : null}
      <span className="mt-auto pt-1.5 text-xs font-medium text-zinc-700">{tile.cta} →</span>
    </Link>
  );
}

export function AdminHomeCommandCenter({
  queues,
  cronSummary,
  criticalCronJobs,
  deferredDiagnostics,
  assignmentWorkQueueTotal,
  payoutQueueCount,
}: Props) {
  const tiles = buildAdminHomeHealthTiles({
    queues,
    cronSummary,
    deferredDiagnostics,
    assignmentWorkQueueTotal,
    payoutQueueCount,
  });
  const deferredOverdue = deferredDiagnostics?.overdueDispatchCount ?? 0;

  return (
    <section aria-label="Operations command center" className="mb-5 space-y-3">
      {criticalCronJobs.length > 0 ? (
        <AdminCronHealthCriticalBanner jobs={criticalCronJobs} />
      ) : null}

      {deferredOverdue > 0 ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
          role="status"
        >
          <span className="font-semibold">{deferredOverdue} deferred dispatch overdue</span>
          {" — "}
          <Link href="/admin/assignments" className="font-medium underline underline-offset-2">
            Open assignments diagnostics
          </Link>
        </p>
      ) : null}

      <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.id}>
            <HealthTile tile={tile} />
          </li>
        ))}
      </ul>

      <nav
        aria-label="Workbench shortcuts"
        className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-zinc-600"
      >
        <Link href="/admin/assignments" className="hover:text-zinc-900">
          Assignments workbench
        </Link>
        <Link href="/admin/bookings" className="hover:text-zinc-900">
          Bookings
        </Link>
        <Link href="/admin/payouts" className="hover:text-zinc-900">
          Payouts
        </Link>
        <Link href="/admin/cleaners" className="hover:text-zinc-900">
          Cleaners
        </Link>
      </nav>

      <details className={ADMIN_DETAILS_DISCLOSURE_CLASS}>
        <summary className={ADMIN_DETAILS_SUMMARY_CLASS}>
          Queue counts
        </summary>
        <div className={`${ADMIN_DETAILS_BODY_CLASS} pb-2 pt-2`}>
          <AdminOperationalQueueStrip queues={queues} compact />
          <p className="mt-2 text-[11px] leading-snug text-zinc-500">
            Open{" "}
            <Link href="/admin/bookings" className="font-medium text-zinc-700 underline underline-offset-2">
              bookings
            </Link>{" "}
            for queue guides and filters.
          </p>
        </div>
      </details>
    </section>
  );
}
