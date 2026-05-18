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
  specialInstructions: string | null;
  earningsLabel: string;
  earnings: CleanerJobEarningSummary[];
};

export function CleanerJobDetailsCard({
  locationSummary,
  specialInstructions,
  earningsLabel,
  earnings,
}: Props) {
  return (
    <section className={`${CLEANER_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
      <h2 className="text-sm font-medium text-zinc-800">Job details</h2>

      <dl className="mt-4 space-y-3">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <dt className="text-xs font-medium text-zinc-500">Address</dt>
          <dd className="text-sm font-medium text-zinc-900 sm:text-right">{locationSummary}</dd>
        </div>
      </dl>

      {specialInstructions ? (
        <section className={`mt-4 ${CLEANER_DETAIL_INSET_CLASS} p-4`}>
          <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Customer notes
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-700">{specialInstructions}</p>
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
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Pay amounts are estimates until the job is confirmed complete.
        </p>
      </section>
    </section>
  );
}
