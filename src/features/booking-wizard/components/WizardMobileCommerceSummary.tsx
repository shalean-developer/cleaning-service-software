import { formatZar } from "../format";
import { WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS } from "../wizardLayout";

type AmountProps = {
  totalCents: number;
};

const stickySummaryAmountClass =
  "mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-zinc-900";

export function ReviewMobileCommerceSummary({ totalCents }: AmountProps) {
  return (
    <div className={WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS} aria-live="polite">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-zinc-500">
        Total
      </p>
      <p className={stickySummaryAmountClass}>{formatZar(totalCents)}</p>
    </div>
  );
}

export function CheckoutMobileCommerceSummary({ totalCents }: AmountProps) {
  return (
    <div className={WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS} aria-live="polite">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-zinc-500">
        Amount due today
      </p>
      <p className={stickySummaryAmountClass}>{formatZar(totalCents)}</p>
    </div>
  );
}
