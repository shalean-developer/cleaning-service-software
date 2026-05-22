import { WIZARD_NAV_LOADING_LABEL } from "@/lib/app/dashboardEcosystemDisplay";
import {
  WIZARD_BTN_PRIMARY,
  WIZARD_BTN_PRIMARY_SHADOW,
  WIZARD_BTN_SECONDARY,
} from "../wizardTheme";

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
      ? `min-h-11 flex-1 px-4 py-3.5 text-sm font-semibold ${WIZARD_BTN_PRIMARY} ${WIZARD_BTN_PRIMARY_SHADOW}`
      : `min-h-11 flex-1 px-4 py-3 text-sm font-medium ${WIZARD_BTN_PRIMARY}`;

  return (
    <div className={rootClass}>
      {showBack && onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className={`min-h-11 flex-1 px-4 py-3 text-sm font-medium ${WIZARD_BTN_SECONDARY}`}
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
