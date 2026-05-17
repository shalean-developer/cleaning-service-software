import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCleanerJobDetail } from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { JobCompletionActions } from "@/components/dashboard/JobCompletionActions";
import { LifecycleTimeline } from "@/components/dashboard/LifecycleTimeline";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import {
  labelForCleanerJobStatus,
  labelForPayoutStatus,
  toneForCleanerJobStatus,
  toneForPayoutStatus,
} from "@/features/bookings/server/statusLabels";

type PageProps = { params: Promise<{ bookingId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bookingId } = await params;
  return { title: `Job ${bookingId.slice(0, 8)} | Cleaner` };
}

export default async function CleanerJobDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { bookingId } = await params;
  const result = await getCleanerJobDetail(user, bookingId);
  if (!result.ok) notFound();

  const job = result.job;

  return (
    <DashboardShell
      title="Job details"
      subtitle={job.serviceLabel}
      nav={[...CLEANER_NAV_ITEMS]}
    >
      <Link href="/cleaner/jobs" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← Back to jobs
      </Link>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <StatusBadge
          label={labelForCleanerJobStatus(job.status)}
          tone={toneForCleanerJobStatus(job.status)}
        />

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <section>
            <dt className="text-zinc-500">Schedule</dt>
            <dd className="font-medium text-zinc-900">{job.scheduleLabel}</dd>
          </section>
          <section className="sm:col-span-2">
            <dt className="text-zinc-500">Location</dt>
            <dd className="font-medium text-zinc-900">{job.locationSummary}</dd>
          </section>
        </dl>

        {job.specialInstructions ? (
          <p className="mt-4 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">Instructions:</span>{" "}
            {job.specialInstructions}
          </p>
        ) : null}

        <JobCompletionActions bookingId={job.bookingId} status={job.status} />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Your earnings</h2>
        {job.earnings.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {job.earnings.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={labelForPayoutStatus(e.payoutStatus)}
                  tone={toneForPayoutStatus(e.payoutStatus)}
                />
                <span className="font-medium text-zinc-900">
                  {formatZar(e.payoutAmountCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm font-medium text-zinc-900">{job.earningsLabel}</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Lifecycle</h2>
        <section className="mt-4">
          <LifecycleTimeline events={job.timeline} />
        </section>
      </section>
    </DashboardShell>
  );
}
