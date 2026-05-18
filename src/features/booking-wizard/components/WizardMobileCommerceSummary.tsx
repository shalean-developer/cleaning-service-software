import { formatZar } from "../format";

type AmountProps = {
  totalCents: number;
};

export function ReviewMobileCommerceSummary({ totalCents }: AmountProps) {
  return (
    <div className="mb-3 md:hidden" aria-live="polite">
      <p className="text-xs font-medium text-zinc-500">Review your booking</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-900">
        {formatZar(totalCents)}
      </p>
    </div>
  );
}

export function CheckoutMobileCommerceSummary({ totalCents }: AmountProps) {
  return (
    <div className="mb-3 md:hidden" aria-live="polite">
      <p className="text-xs font-medium text-zinc-500">Amount due today</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-900">
        {formatZar(totalCents)}
      </p>
    </div>
  );
}
