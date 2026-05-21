import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { ADMIN_DETAIL_CARD_CLASS } from "@/features/dashboards/adminDisplay";
import { getAdminRecurringSeriesDetail } from "@/features/recurring/server/adminRecurringSeriesReadModel";
import { AdminRecurringSeriesActions } from "@/components/dashboard/admin/recurring/AdminRecurringSeriesActions";
import { AdminRecurringSeriesTimeline } from "@/components/dashboard/admin/recurring/AdminRecurringSeriesTimeline";
import { AdminRecurringRescheduleForm } from "@/components/dashboard/admin/recurring/AdminRecurringRescheduleForm";
import { AdminRecurringSupportRequestPanel } from "@/components/dashboard/admin/recurring/AdminRecurringSupportRequestPanel";

type PageProps = { params: Promise<{ seriesId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { seriesId } = await params;
  return { title: `Series ${seriesId.slice(0, 8)} | Admin` };
}

export default async function AdminRecurringDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { seriesId } = await params;
  const result = await getAdminRecurringSeriesDetail(user, seriesId);
  if (!result.ok) notFound();

  const s = result.series;

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <Link
        href="/admin/recurring"
        className="text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        ← Recurring series
      </Link>

      <header className="mt-4 space-y-1">
        <h1 className="font-serif text-3xl font-medium text-slate-900">
          {s.customerName} · {s.serviceLabel}
        </h1>
        <p className="text-sm text-slate-600">
          {s.frequencyLabel} · {s.statusLabel} · {s.priceLabel} per visit
        </p>
      </header>

      {s.openSupportRequest ? (
        <div className="mt-6">
          <AdminRecurringSupportRequestPanel
            seriesId={s.seriesId}
            request={s.openSupportRequest}
          />
        </div>
      ) : null}

      <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} space-y-4 p-5`}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Customer</dt>
            <dd className="font-medium text-slate-900">
              <Link href={`/admin/customers/${s.customerId}`} className="text-blue-700">
                {s.customerName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Address</dt>
            <dd className="text-slate-900">{s.addressSummary}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Next visit</dt>
            <dd className="text-slate-900">
              {s.nextOccurrenceScheduleLabel ?? "—"}
              {s.nextOccurrencePaymentRequired ? " (payment required)" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Timezone</dt>
            <dd className="text-slate-900">{s.timezone}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Anchor booking</dt>
            <dd>
              <Link
                href={`/admin/bookings/${s.createdFromBookingId}`}
                className="font-medium text-blue-700"
              >
                Open first paid visit
              </Link>
            </dd>
          </div>
          {s.latestChildBookingId ? (
            <div>
              <dt className="text-slate-500">Latest child</dt>
              <dd>
                <Link
                  href={`/admin/bookings/${s.latestChildBookingId}`}
                  className="font-medium text-blue-700"
                >
                  Open latest booking
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>

        <AdminRecurringSeriesActions seriesId={s.seriesId} actions={s.actions} />

        {s.actions.canRescheduleNext ? (
          <AdminRecurringRescheduleForm
            seriesId={s.seriesId}
            currentNext={s.nextOccurrenceAt}
          />
        ) : null}
      </section>

      <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} p-5`}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Visit timeline
        </h2>
        <div className="mt-4">
          <AdminRecurringSeriesTimeline entries={s.timeline} />
        </div>
      </section>

      {s.auditNotes.length > 0 ? (
        <section className={`mt-6 ${ADMIN_DETAIL_CARD_CLASS} p-5`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Audit notes
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {s.auditNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminDashboardShell>
  );
}
