"use client";

import { formatZar } from "../format";
import type { WizardBookingSummarySnapshot } from "../wizardBookingSummaryDisplay";
import {
  UI_CARD_SHELL_CLASS,
  UI_HELPER_TEXT_CLASS,
} from "@/lib/ui/productUiTokens";

type Props = {
  snapshot: WizardBookingSummarySnapshot;
  /** Shown under the estimated total (e.g. cleaner step reassurance). */
  footnote?: string;
};

function SecondaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-3 text-xs leading-snug">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-slate-700 [overflow-wrap:anywhere]">
        {value}
      </dd>
    </div>
  );
}

function BookingSummaryCard({ snapshot, footnote }: Props) {
  const { secondaryRows, estimatedTotalCents } = snapshot;

  return (
    <div className={`${UI_CARD_SHELL_CLASS} p-4`}>
      <h2 className="sr-only">Booking summary</h2>

      {secondaryRows.length > 0 ? (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-xs font-medium text-slate-500 outline-none marker:content-none hover:text-slate-700 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">More details</span>
            <span className="hidden group-open:inline">Hide details</span>
          </summary>
          <dl className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
            {secondaryRows.map((row) => (
              <SecondaryRow key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </details>
      ) : null}

      <div className="mt-4 border-t border-slate-100 pt-3" aria-live="polite">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
          Estimated total
        </p>
        {estimatedTotalCents != null ? (
          <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-shalean-navy">
            {formatZar(estimatedTotalCents)}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-slate-600">Add home details to see an estimate.</p>
        )}
        <p className={`mt-1 ${UI_HELPER_TEXT_CLASS}`}>Estimate only. confirmed on review.</p>
      </div>

      {footnote ? <p className={`mt-2.5 ${UI_HELPER_TEXT_CLASS}`}>{footnote}</p> : null}
    </div>
  );
}

/** Desktop/tablet sticky sidebar for wizard steps with summary layout. */
export function WizardBookingSummarySidebar(props: Props) {
  return (
    <aside
      className="hidden min-w-0 md:block md:sticky md:top-6 md:self-start"
      aria-label="Booking summary"
    >
      <BookingSummaryCard {...props} />
    </aside>
  );
}

/** Mobile inline summary shown above wizard actions. */
export function WizardBookingSummaryMobileCard(props: Props) {
  return (
    <div className="min-w-0 md:hidden" aria-label="Booking summary">
      <BookingSummaryCard {...props} />
    </div>
  );
}
