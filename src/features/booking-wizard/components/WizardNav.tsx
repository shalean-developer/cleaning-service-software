import { WIZARD_NAV_LOADING_LABEL } from "@/lib/app/dashboardEcosystemDisplay";

type Props = {
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  showBack?: boolean;
  className?: string;
  /** Presentation-only emphasis for the final Paystack action. */
  continueVariant?: "default" | "secure";
};

export function WizardNav({
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  loading = false,
  showBack = true,
  className,
  continueVariant = "default",
}: Props) {
  const rootClass = className
    ? `flex w-full min-w-0 gap-3 ${className}`
    : "mt-8 flex w-full min-w-0 gap-3";
  const continueClass =
    continueVariant === "secure"
      ? "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={rootClass}>
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:opacity-50"
        >
          Back
        </button>
      ) : null}
      {onContinue ? (
        <button
          type="button"
          onClick={onContinue}
          disabled={continueDisabled || loading}
          className={continueClass}
        >
          {loading ? WIZARD_NAV_LOADING_LABEL : continueLabel}
        </button>
      ) : null}
    </div>
  );
}
