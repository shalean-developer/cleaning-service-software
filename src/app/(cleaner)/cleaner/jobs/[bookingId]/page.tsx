import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCleanerJobDetail } from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CleanerDashboardHeaderEndLoader } from "@/components/dashboard/cleaner/CleanerDashboardHeaderEndLoader";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { JobCompletionActions } from "@/components/dashboard/JobCompletionActions";
import { CleanerJobMobileActionBar } from "@/components/dashboard/cleaner/CleanerJobMobileActionBar";
import { CleanerJobDetailsCard } from "@/components/dashboard/cleaner/CleanerJobDetailsCard";
import { CleanerJobStatusHero } from "@/components/dashboard/cleaner/CleanerJobStatusHero";
import { CleanerJobWhatHappensNext } from "@/components/dashboard/cleaner/CleanerJobWhatHappensNext";
import { CleanerLifecycleTimeline } from "@/components/dashboard/cleaner/CleanerLifecycleTimeline";
import { CleanerTeamJobSection } from "@/components/dashboard/cleaner/CleanerTeamJobSection";
import { CleanerSupportJobNotice } from "@/components/dashboard/cleaner/CleanerSupportJobNotice";
import { SupportParticipationActions } from "@/components/dashboard/cleaner/SupportParticipationActions";
import { getAirbnbCleanerJobCopy, isAirbnbOperationalBooking } from "@/features/dashboards/airbnbOperationalDisplay";
import {
  getDeepCleanerJobCopy,
  isDeepOperationalBooking,
} from "@/features/dashboards/deepOperationalDisplay";
import {
  getCarpetCleanerJobCopy,
  isCarpetOperationalBooking,
} from "@/features/dashboards/carpetOperationalDisplay";
import {
  getMovingCleanerJobCopy,
  isMovingOperationalBooking,
} from "@/features/dashboards/movingOperationalDisplay";
import {
  getOfficeCleanerJobCopy,
  isOfficeOperationalBooking,
  resolveOfficeOperationalSlug,
} from "@/features/dashboards/officeOperationalDisplay";
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
  const opsJob = isAirbnbOperationalBooking({ serviceLabel: job.serviceLabel })
    ? getAirbnbCleanerJobCopy()
    : isOfficeOperationalBooking({ serviceLabel: job.serviceLabel })
      ? getOfficeCleanerJobCopy()
      : isMovingOperationalBooking({ serviceLabel: job.serviceLabel })
        ? getMovingCleanerJobCopy()
        : isDeepOperationalBooking({ serviceLabel: job.serviceLabel })
          ? getDeepCleanerJobCopy()
          : isCarpetOperationalBooking({ serviceLabel: job.serviceLabel })
            ? getCarpetCleanerJobCopy()
            : null;
  const resolvedServiceSlug =
    job.serviceLabel === "Airbnb Cleaning"
      ? "airbnb-cleaning"
      : resolveOfficeOperationalSlug({ serviceLabel: job.serviceLabel });

  return (
    <DashboardShell
      title="Your job"
      subtitle={opsJob?.shellSubtitle ?? "Schedule, location, pay, and next steps."}
      nav={[...CLEANER_NAV_ITEMS]}
      headerEnd={<CleanerDashboardHeaderEndLoader />}
    >
      <Link
        href="/cleaner/jobs"
        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      >
        ← Back to jobs
      </Link>

      <section className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
        <CleanerJobStatusHero
          serviceSlug={resolvedServiceSlug}
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

        <CleanerJobWhatHappensNext
          status={job.status}
          serviceLabel={job.serviceLabel}
        />

        {job.team.viewerRole === "support" ? (
          <>
            <CleanerSupportJobNotice message="Lead cleaner starts and completes this job. Confirm below after helping on site. records support participation only." />
            <SupportParticipationActions
              bookingId={job.bookingId}
              canMarkParticipation={job.team.supportParticipation.canMarkParticipation}
              hasMarkedParticipation={job.team.supportParticipation.hasMarkedParticipation}
            />
          </>
        ) : null}

        <CleanerJobDetailsCard
          serviceLabel={job.serviceLabel}
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

        <section className={`${CLEANER_DETAIL_CARD_CLASS} p-3.5 sm:p-4`}>
          <h2 className="text-sm font-medium text-zinc-800">
            {opsJob?.activitySectionTitle ?? "Activity"}
          </h2>
          <section className="mt-2.5">
            <CleanerLifecycleTimeline events={job.timeline} />
          </section>
        </section>
      </section>

      {showActions ? (
        <CleanerJobMobileActionBar bookingId={job.bookingId} status={job.status} />
      ) : null}
    </DashboardShell>
  );
}
