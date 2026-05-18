import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCleanerJobDetail } from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { JobCompletionActions } from "@/components/dashboard/JobCompletionActions";
import { CleanerJobDetailsCard } from "@/components/dashboard/cleaner/CleanerJobDetailsCard";
import { CleanerJobStatusHero } from "@/components/dashboard/cleaner/CleanerJobStatusHero";
import { CleanerJobWhatHappensNext } from "@/components/dashboard/cleaner/CleanerJobWhatHappensNext";
import { CleanerLifecycleTimeline } from "@/components/dashboard/cleaner/CleanerLifecycleTimeline";
import { CleanerTeamJobSection } from "@/components/dashboard/cleaner/CleanerTeamJobSection";
import { CleanerSupportJobNotice } from "@/components/dashboard/cleaner/CleanerSupportJobNotice";
import { SupportParticipationActions } from "@/components/dashboard/cleaner/SupportParticipationActions";
import { CLEANER_DETAIL_CARD_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";

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
  const showActions =
    job.team.canStartJob &&
    (job.status === "assigned" || job.status === "in_progress");

  return (
    <DashboardShell
      title="Your job"
      subtitle="Schedule, location, pay, and what to do next."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      <Link
        href="/cleaner/jobs"
        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      >
        ← Back to jobs
      </Link>

      <section className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
        <CleanerJobStatusHero
          serviceLabel={job.serviceLabel}
          scheduleLabel={job.scheduleLabel}
          locationSummary={job.locationSummary}
          earningsLabel={job.earningsLabel}
          status={job.status}
          actionSlot={
            showActions ? (
              <JobCompletionActions bookingId={job.bookingId} status={job.status} />
            ) : undefined
          }
        />

        {job.team.isTeamJob ? <CleanerTeamJobSection team={job.team} /> : null}

        <CleanerJobWhatHappensNext status={job.status} />

        {job.team.viewerRole === "support" ? (
          <>
            <CleanerSupportJobNotice message="The lead cleaner starts and completes this job. Confirm below when you have helped on site — this records your support participation only and does not complete the booking." />
            <SupportParticipationActions
              bookingId={job.bookingId}
              canMarkParticipation={job.team.supportParticipation.canMarkParticipation}
              hasMarkedParticipation={job.team.supportParticipation.hasMarkedParticipation}
            />
          </>
        ) : null}

        <CleanerJobDetailsCard
          locationSummary={job.locationSummary}
          homeSizeSummary={job.homeSizeSummary}
          cleaningIntensityLabel={job.cleaningIntensityLabel}
          equipmentSupplyOperationalLabel={job.equipmentSupplyOperationalLabel}
          teamSupportCleanerNote={job.teamSupportCleanerNote}
          specialInstructions={job.specialInstructions}
          earningsLabel={job.earningsLabel}
          earnings={job.earnings}
          showPayEstimateNote={job.team.viewerRole !== "support"}
        />

        <section className={`${CLEANER_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
          <h2 className="text-sm font-medium text-zinc-800">Activity</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            Job progress from assignment through completion.
          </p>
          <section className="mt-3">
            <CleanerLifecycleTimeline events={job.timeline} />
          </section>
        </section>
      </section>
    </DashboardShell>
  );
}
