import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import {
  CLEANER_DETAIL_CARD_CLASS,
  CLEANER_DETAIL_INSET_CLASS,
} from "@/features/dashboards/cleanerJobDetailDisplay";
import {
  labelForPayoutStatus,
  toneForPayoutStatus,
} from "@/features/bookings/server/statusLabels";
import type { CleanerJobEarningSummary } from "@/features/dashboards/server/types";

type Props = {
  locationSummary: string;
  homeSizeSummary: string | null;
  cleaningIntensityLabel: string | null;
  equipmentSupplyOperationalLabel: string | null;
  teamSupportCleanerNote: string | null;
  specialInstructions: string | null;
  earningsLabel: string;
  earnings: CleanerJobEarningSummary[];
  /** NF-7E: hide per-cleaner estimate footnote for support roster role. */
  showPayEstimateNote?: boolean;
};

export function CleanerJobDetailsCard({
  locationSummary,
  homeSizeSummary,
  cleaningIntensityLabel,
  equipmentSupplyOperationalLabel,
  teamSupportCleanerNote,
  specialInstructions,
  earningsLabel,
  earnings,
  showPayEstimateNote = true,
}: Props) {
  return (
    <section className={`${CLEANER_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className="text-sm font-medium text-zinc-800">Job details</h2>

      <dl className="mt-4 space-y-3">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <dt className="text-xs font-medium text-zinc-500">Address</dt>
          <dd className="text-sm font-medium text-zinc-900 sm:text-right">{locationSummary}</dd>
        </div>
        {homeSizeSummary ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-xs font-medium text-zinc-500">Home size</dt>
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

      {specialInstructions || teamSupportCleanerNote ? (
        <section className={`mt-4 ${CLEANER_DETAIL_INSET_CLASS} p-4`}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Customer notes
          </h3>
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

      <section className="mt-5 border-t border-zinc-100 pt-4" aria-labelledby="cleaner-pay-heading">
        <h3 id="cleaner-pay-heading" className="text-sm font-medium text-zinc-800">
          Your pay
        </h3>
        {earnings.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {earnings.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <StatusBadge
                  label={labelForPayoutStatus(e.payoutStatus)}
                  tone={toneForPayoutStatus(e.payoutStatus)}
                  variant="soft"
                />
                <span className="font-semibold tabular-nums text-zinc-900">
                  {formatZar(e.payoutAmountCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm font-semibold tabular-nums text-zinc-900">{earningsLabel}</p>
        )}
        {showPayEstimateNote ? (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Pay amounts are estimates until the job is confirmed complete.
          </p>
        ) : null}
      </section>
    </section>
  );
}
