import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";
import { getCustomerRecurringSeriesDetail } from "@/features/recurring/server/customerRecurringSeriesReadModel";
import { PayNextVisitButton } from "@/components/dashboard/customer/PayNextVisitButton";
import { CustomerRecurringRequestActions } from "@/components/dashboard/customer/CustomerRecurringRequestActions";
import { AdminRecurringSeriesTimeline } from "@/components/dashboard/admin/recurring/AdminRecurringSeriesTimeline";

type PageProps = { params: Promise<{ seriesId: string }> };

export default async function CustomerRecurringDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { seriesId } = await params;
  const result = await getCustomerRecurringSeriesDetail(user, seriesId);
  if (!result.ok) notFound();

  const s = result.series;
  const customerEmail = user.authUser.email?.trim() ?? "";

  return (
    <DashboardShell
      title={s.serviceLabel}
      subtitle={`${s.frequencyLabel} · ${s.statusLabel}`}
      nav={[...CUSTOMER_DASHBOARD_NAV]}
      headerEnd={<CustomerDashboardHeaderEndLoader />}
    >
      <Link
        href="/customer/bookings/recurring"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        ← Recurring cleans
      </Link>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-sm text-zinc-600">{s.locationSummary}</p>
        <p className="mt-2 text-sm font-medium text-zinc-900">
          Next visit: {s.nextOccurrenceScheduleLabel ?? "To be scheduled"}
        </p>
        {s.actions.canPayNextVisit && s.nextOccurrenceBookingId ? (
          <div className="mt-4">
            <PayNextVisitButton
              bookingId={s.nextOccurrenceBookingId}
              customerEmail={customerEmail}
            />
            <p className="mt-2 text-xs text-zinc-500">
              Pay to confirm this visit. Cleaners are assigned after payment. each visit is paid
              separately, not billed automatically.
            </p>
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Change your schedule</h2>
        <p className="mt-1 text-sm text-zinc-600">
          You can request pause, reschedule, or cancellation. Our team reviews every request and
          confirms before your schedule changes. nothing is changed automatically.
        </p>
        <div className="mt-3">
          <CustomerRecurringRequestActions seriesId={s.seriesId} actions={s.actions} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Visits</h2>
        <div className="mt-3">
          <AdminRecurringSeriesTimeline
            entries={s.timeline}
            bookingBasePath="/customer/bookings"
          />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Tap a booking from your main list for full payment and assignment details.
        </p>
      </section>
    </DashboardShell>
  );
}
