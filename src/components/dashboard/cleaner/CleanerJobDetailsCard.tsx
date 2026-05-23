import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CleanerPayDisplay } from "@/components/dashboard/cleaner/CleanerPayDisplay";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { CLEANER_LIST_CARD_PADDING } from "@/features/dashboards/cleanerDashboardDisplay";
import {
  getAirbnbCleanerJobCopy,
  isAirbnbOperationalBooking,
} from "@/features/dashboards/airbnbOperationalDisplay";
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
} from "@/features/dashboards/officeOperationalDisplay";
import {
  CLEANER_DETAIL_CARD_CLASS,
  CLEANER_DETAIL_INSET_CLASS,
} from "@/features/dashboards/cleanerJobDetailDisplay";
import {
  cleanerPayoutStatusHelper,
  labelForCleanerPayoutStatus,
  toneForCleanerPayoutStatus,
} from "@/features/dashboards/cleanerEarningsPresentation";
import type { CleanerJobEarningSummary } from "@/features/dashboards/server/types";

type Props = {
  serviceLabel?: string | null;
  locationSummary: string;
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyOperationalLabel: string | null;
  teamSupportCleanerNote: string | null;
  specialInstructions: string | null;
  operationalAccessNotes: string | null;
  earningsLabel: string;
  earnings: CleanerJobEarningSummary[];
  /** NF-7E: hide per-cleaner estimate footnote for support roster role. */
  showPayEstimateNote?: boolean;
};

export function CleanerJobDetailsCard({
  serviceLabel,
  locationSummary,
  homeSizeSummary,
  cleaningIntensityLabel,
  equipmentSupplyOperationalLabel,
  teamSupportCleanerNote,
  specialInstructions,
  operationalAccessNotes,
  earningsLabel,
  earnings,
  showPayEstimateNote = true,
}: Props) {
  const opsJob = isAirbnbOperationalBooking({ serviceLabel })
    ? getAirbnbCleanerJobCopy()
    : isOfficeOperationalBooking({ serviceLabel })
      ? getOfficeCleanerJobCopy()
      : isMovingOperationalBooking({ serviceLabel })
        ? getMovingCleanerJobCopy()
        : isDeepOperationalBooking({ serviceLabel })
          ? getDeepCleanerJobCopy()
          : isCarpetOperationalBooking({ serviceLabel })
            ? getCarpetCleanerJobCopy()
            : null;

  return (
    <section className={`${CLEANER_DETAIL_CARD_CLASS} ${CLEANER_LIST_CARD_PADDING}`}>
      <h2 className="text-sm font-medium text-zinc-800">
        {opsJob?.detailsSectionTitle ?? "Job details"}
      </h2>

      <dl className="mt-3 space-y-2.5">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <dt className="text-xs font-medium text-zinc-500">
            {opsJob?.addressLabel ?? "Address"}
          </dt>
          <dd className="text-sm font-medium text-zinc-900 sm:text-right">{locationSummary}</dd>
        </div>
        {homeSizeSummary ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500">
              {opsJob?.homeSizeLabel ?? "Home size"}
            </dt>
            <dd className="text-sm font-medium text-zinc-900 sm:text-right">{homeSizeSummary}</dd>
          </div>
        ) : null}
        {cleaningIntensityLabel ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500">Cleaning intensity</dt>
            <dd className="text-sm font-medium text-zinc-900 sm:text-right">
              {cleaningIntensityLabel}
            </dd>
          </div>
        ) : null}
        {equipmentSupplyOperationalLabel ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500">Supplies & equipment</dt>
            <dd
              className={`text-sm font-medium sm:text-right ${
                equipmentSupplyOperationalLabel === "Bring cleaning equipment"
                  ? "text-sky-900"
                  : "text-zinc-900"
              }`}
            >
              {equipmentSupplyOperationalLabel}
            </dd>
          </div>
        ) : null}
      </dl>

      {operationalAccessNotes ? (
        <section className={`mt-3 ${CLEANER_DETAIL_INSET_CLASS} px-3 py-2.5`}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Access notes</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-700">
            {operationalAccessNotes}
          </p>
        </section>
      ) : null}

      {specialInstructions || teamSupportCleanerNote ? (
        <section className={`mt-3 ${CLEANER_DETAIL_INSET_CLASS} px-3 py-2.5`}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {opsJob?.notesSectionTitle ?? "Customer notes"}
          </h3>
          {opsJob ? (
            <p className="mt-1 text-xs leading-snug text-zinc-500">{opsJob.notesIntro}</p>
          ) : null}
          {teamSupportCleanerNote ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{teamSupportCleanerNote}</p>
          ) : null}
          {specialInstructions ? (
            <p
              className={`text-sm leading-relaxed text-zinc-700 ${
                teamSupportCleanerNote ? "mt-2" : "mt-2"
              }`}
            >
              {specialInstructions}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="mt-4 border-t border-zinc-100 pt-3" aria-labelledby="cleaner-pay-heading">
        <h3 id="cleaner-pay-heading" className="text-sm font-medium text-zinc-800">
          Your pay
        </h3>
        {earnings.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {earnings.map((e) => {
              const statusHelper = cleanerPayoutStatusHelper(e.payoutStatus);
              return (
                <li key={e.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <StatusBadge
                        label={labelForCleanerPayoutStatus(e.payoutStatus)}
                        tone={toneForCleanerPayoutStatus(e.payoutStatus)}
                        variant="soft"
                      />
                      {statusHelper ? (
                        <p className="mt-1 text-xs leading-snug text-zinc-500">{statusHelper}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-lg font-semibold tabular-nums text-zinc-900">
                      {formatZar(e.payoutAmountCents)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-2">
            <CleanerPayDisplay
              earningsLabel={earningsLabel}
              variant="inline"
              includeCalculatingHelper
            />
          </div>
        )}
        {showPayEstimateNote && earnings.length === 0 ? (
          <p className="mt-1.5 text-xs text-zinc-500">Estimate until the job is confirmed complete.</p>
        ) : null}
      </section>
    </section>
  );
}
