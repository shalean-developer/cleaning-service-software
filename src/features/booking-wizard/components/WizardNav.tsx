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
  const rootClass = className ? `flex gap-3 ${className}` : "mt-8 flex gap-3";
  const continueClass =
    continueVariant === "secure"
      ? "flex-1 rounded-xl bg-zinc-900 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(24,24,27,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
      : "flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className={rootClass}>
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 disabled:opacity-50"
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
          {loading ? "Please wait…" : continueLabel}
        </button>
      ) : null}
    </div>
  );
}
