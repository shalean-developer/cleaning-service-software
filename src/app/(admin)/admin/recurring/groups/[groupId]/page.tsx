import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { ADMIN_DETAIL_CARD_CLASS } from "@/features/dashboards/adminDisplay";
import { getAdminRecurringScheduleGroupDetail } from "@/features/recurring/server/adminRecurringGroupDetailReadModel";
import { formatSelectedDaysShort, RECURRING_WEEKDAY_LABELS } from "@/features/recurring/recurringScheduleDays";
import { AdminRecurringGroupSummaryCards } from "@/components/dashboard/admin/recurring/AdminRecurringGroupSummaryCards";
import { AdminRecurringScheduleGroupActions } from "@/components/dashboard/admin/recurring/AdminRecurringScheduleGroupActions";
import { AdminRecurringGroupWeekdaySeriesPanel } from "@/components/dashboard/admin/recurring/AdminRecurringGroupWeekdaySeriesPanel";
import { AdminRecurringGroupTimeline } from "@/components/dashboard/admin/recurring/AdminRecurringGroupTimeline";
import { AdminRecurringGroupSupportRequestsPanel } from "@/components/dashboard/admin/recurring/AdminRecurringGroupSupportRequestsPanel";

type PageProps = { params: Promise<{ groupId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { groupId } = await params;
  return { title: `Schedule group ${groupId.slice(0, 8)} | Admin` };
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "bg-emerald-100 text-emerald-900";
  if (status === "paused") return "bg-amber-100 text-amber-950";
  return "bg-slate-200 text-slate-800";
}

export default async function AdminRecurringGroupDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { groupId } = await params;
  const result = await getAdminRecurringScheduleGroupDetail(user, groupId);
  if (!result.ok) notFound();

  const g = result.group;

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <nav className="text-sm text-slate-600" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/admin" className="hover:text-slate-900">
              Admin
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/admin/recurring" className="hover:text-slate-900">
              Recurring
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="font-medium text-slate-900">Group</li>
        </ol>
      </nav>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-medium text-slate-900">{g.titleLabel}</h1>
          <p className="text-sm text-slate-600">
            {g.customerName} · {g.frequencyLabel} · {g.selectedDaysLabel}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusBadgeClass(g.status)}`}
        >
          {g.statusLabel}
        </span>
      </header>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin/recurring"
          className="font-medium text-slate-600 hover:text-slate-900"
        >
          ← All recurring
        </Link>
        <Link
          href="/admin/recurring/health"
          className="font-medium text-blue-700 hover:text-blue-900"
        >
          Recurring health
        </Link>
      </div>

      <div className="mt-6">
        <AdminRecurringGroupSummaryCards group={g} />
      </div>

      <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} space-y-4 p-5`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Schedule group overview
        </h2>
        <div className="flex flex-wrap gap-2">
          {g.selectedDays.map((day) => (
            <span
              key={day}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-900"
            >
              {RECURRING_WEEKDAY_LABELS[day] ?? day}
            </span>
          ))}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Frequency</dt>
            <dd className="text-slate-900">{g.frequencyLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Service</dt>
            <dd className="text-slate-900">{g.serviceLabel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Address</dt>
            <dd className="text-slate-900">
              {g.addressSummary}
              {g.suburb ? ` (${g.suburb})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Timezone</dt>
            <dd className="text-slate-900">{g.timezone}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-900">
              {new Date(g.createdAt).toLocaleString("en-ZA")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Anchor booking</dt>
            <dd>
              <Link
                href={`/admin/bookings/${g.anchorBookingId}`}
                className="font-medium text-blue-700"
              >
                Open first paid visit
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Customer</dt>
            <dd className="font-medium text-slate-900">
              <Link href={`/admin/customers/${g.customerId}`} className="text-blue-700">
                {g.customerName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Selected days</dt>
            <dd className="text-slate-900">{formatSelectedDaysShort(g.selectedDays)}</dd>
          </div>
        </dl>
      </section>

      <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} p-5`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Group actions
        </h2>
        <AdminRecurringScheduleGroupActions groupId={g.groupId} actions={g.actions} />
      </section>

      <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} p-5`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Weekday series
        </h2>
        <div className="mt-4">
          <AdminRecurringGroupWeekdaySeriesPanel series={g.weekdaySeries} />
        </div>
      </section>

      <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} p-5`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Child visit timeline
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          All generated visits across weekday series. Synthetic cadence anchors are excluded.
        </p>
        <div className="mt-4">
          <AdminRecurringGroupTimeline entries={g.timeline} />
        </div>
      </section>

      <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} p-5`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Customer requests
        </h2>
        <div className="mt-4">
          <AdminRecurringGroupSupportRequestsPanel
            open={g.supportRequests.open}
            acknowledged={g.supportRequests.acknowledged}
            resolved={g.supportRequests.resolved}
          />
        </div>
      </section>

      {g.groupAuditNotes.length > 0 ? (
        <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} p-5`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Audit notes
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {g.groupAuditNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminDashboardShell>
  );
}
