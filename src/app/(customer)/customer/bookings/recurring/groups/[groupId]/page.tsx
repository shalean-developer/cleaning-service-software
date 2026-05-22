import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";
import { getCustomerRecurringScheduleGroupDetail } from "@/features/recurring/server/customerRecurringGroupDetailReadModel";
import { CustomerRecurringGroupSummaryCards } from "@/components/dashboard/customer/CustomerRecurringGroupSummaryCards";
import { CustomerRecurringGroupWeekdayPanel } from "@/components/dashboard/customer/CustomerRecurringGroupWeekdayPanel";
import { CustomerRecurringGroupVisitsPanel } from "@/components/dashboard/customer/CustomerRecurringGroupVisitsPanel";
import { CustomerRecurringGroupRequestActions } from "@/components/dashboard/customer/CustomerRecurringGroupRequestActions";
import { CustomerRecurringGroupRequestHistory } from "@/components/dashboard/customer/CustomerRecurringGroupRequestHistory";
import { RECURRING_WEEKDAY_LABELS } from "@/features/recurring/recurringScheduleDays";
import { PayNextVisitButton } from "@/components/dashboard/customer/PayNextVisitButton";

type PageProps = { params: Promise<{ groupId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { groupId } = await params;
  return { title: `Recurring schedule ${groupId.slice(0, 8)} | Customer` };
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "bg-emerald-100 text-emerald-900";
  if (status === "paused") return "bg-amber-100 text-amber-950";
  return "bg-zinc-200 text-zinc-800";
}

export default async function CustomerRecurringGroupDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { groupId } = await params;
  const result = await getCustomerRecurringScheduleGroupDetail(user, groupId);
  if (!result.ok) notFound();

  const g = result.group;
  const customerEmail = user.authUser.email?.trim() ?? "";

  return (
    <DashboardShell
      title="Recurring cleaning schedule"
      subtitle={g.subtitleLabel}
      nav={[...CUSTOMER_DASHBOARD_NAV]}
      headerEnd={<CustomerDashboardHeaderEndLoader />}
    >
      <nav className="text-sm text-zinc-600" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/customer/bookings" className="hover:text-zinc-900">
              Bookings
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li>
            <Link href="/customer/bookings/recurring" className="hover:text-zinc-900">
              Recurring
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li className="font-medium text-zinc-900">Schedule</li>
        </ol>
      </nav>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/customer/bookings/recurring"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← Recurring schedules
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusBadgeClass(g.status)}`}
        >
          {g.statusLabel}
        </span>
      </div>

      <div className="mt-6">
        <CustomerRecurringGroupSummaryCards group={g} />
      </div>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Schedule overview</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {g.selectedDays.map((day) => (
            <span
              key={day}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold text-zinc-800"
            >
              {RECURRING_WEEKDAY_LABELS[day] ?? day}
            </span>
          ))}
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Frequency</dt>
            <dd className="font-medium text-zinc-900">{g.frequencyLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Shared time</dt>
            <dd className="font-medium text-zinc-900">{g.sharedTimeLabel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Service</dt>
            <dd className="font-medium text-zinc-900">{g.serviceLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Location</dt>
            <dd className="font-medium text-zinc-900">
              {g.addressSummary}
              {g.suburb ? ` (${g.suburb})` : ""}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-zinc-600">
          Each recurring visit is paid individually. Cleaners are assigned after payment.
        </p>
      </section>

      {g.nextPaymentRequiredVisit ? (
        <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <h2 className="text-sm font-semibold text-amber-950">Next payment required</h2>
          <p className="mt-1 text-sm text-amber-900">
            {g.nextPaymentRequiredVisit.weekdayLabel} ·{" "}
            {g.nextPaymentRequiredVisit.scheduleLabel}
          </p>
          <div className="mt-3">
            <PayNextVisitButton
              bookingId={g.nextPaymentRequiredVisit.bookingId}
              customerEmail={customerEmail}
            />
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Weekday schedule</h2>
        <div className="mt-3">
          <CustomerRecurringGroupWeekdayPanel series={g.weekdaySeries} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Upcoming & completed visits</h2>
        <div className="mt-3">
          <CustomerRecurringGroupVisitsPanel
            upcomingVisits={g.upcomingVisits}
            completedVisits={g.completedVisits}
            customerEmail={customerEmail}
          />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Request a change</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Pause, cancel, or reschedule your full schedule or a single weekday. Our team reviews
          every request before anything changes.
        </p>
        <div className="mt-3">
          <CustomerRecurringGroupRequestActions
            groupId={g.groupId}
            actions={g.actions}
            weekdaySeries={g.weekdaySeries}
          />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Request history</h2>
        <div className="mt-3">
          <CustomerRecurringGroupRequestHistory
            open={g.supportRequests.open}
            acknowledged={g.supportRequests.acknowledged}
            resolved={g.supportRequests.resolved}
            rejected={g.supportRequests.rejected}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
