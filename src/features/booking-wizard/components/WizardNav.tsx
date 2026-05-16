type Props = {
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  showBack?: boolean;
};

export function WizardNav({
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  loading = false,
  showBack = true,
}: Props) {
  return (
    <div className="mt-8 flex gap-3">
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
          className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Please wait…" : continueLabel}
        </button>
      ) : null}
    </div>
  );
}
