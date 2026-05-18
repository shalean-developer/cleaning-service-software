import type { WizardStep } from "./types";

/** Centered booking page shell shared across wizard steps. */
export const WIZARD_SHELL_BASE =
  "mx-auto flex min-h-screen w-full flex-col overflow-x-clip bg-zinc-50 px-4 py-6";

/** Primary picker and review steps — wide centered column. */
export const WIZARD_SHELL_MAX_DESKTOP = "max-w-3xl";

/** Literal wide shell for Tailwind scan + service/schedule parity (do not join dynamically). */
export const WIZARD_SHELL_WIDE_CLASS =
  "mx-auto flex min-h-screen w-full max-w-3xl flex-col overflow-x-clip bg-zinc-50 px-4 py-6";

/** Default narrow column for steps not yet widened; schedule keeps this on mobile only. */
export const WIZARD_SHELL_MAX_MOBILE = "max-w-lg";

export const WIZARD_SHELL_PB_DEFAULT = "pb-24";

/** Service step: room for fixed mobile Continue bar. */
export const WIZARD_SHELL_PB_SERVICE =
  "pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] md:pb-24";

/** Details step: room for fixed mobile nav only. */
export const WIZARD_SHELL_PB_DETAILS_STICKY = WIZARD_SHELL_PB_SERVICE;

/** Review / checkout: room for fixed mobile summary + nav. */
export const WIZARD_SHELL_PB_SUMMARY_STICKY =
  "pb-[calc(10.75rem+env(safe-area-inset-bottom,0px))] md:pb-24";

/** Shared mobile sticky footer chrome (summary + nav); desktop stays in flow. */
export const WIZARD_MOBILE_STICKY_FOOTER_CLASS =
  "fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200/90 bg-zinc-50/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm md:static md:w-full md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:shadow-none md:backdrop-blur-none";

const WIDE_DESKTOP_STEPS: WizardStep[] = [
  "service",
  "datetime",
  "location",
  "details",
  "cleaner",
  "review",
  "checkout",
];

export function usesWideDesktopShell(step: WizardStep): boolean {
  return WIDE_DESKTOP_STEPS.includes(step);
}

/** Service through checkout share the same shell width (`max-w-3xl`). */
function getWidePickerShellClass(
  step:
    | "service"
    | "datetime"
    | "location"
    | "details"
    | "cleaner"
    | "review"
    | "checkout",
): string {
  const paddingBottom =
    step === "service"
      ? WIZARD_SHELL_PB_SERVICE
      : step === "review" || step === "checkout"
        ? WIZARD_SHELL_PB_SUMMARY_STICKY
        : step === "datetime" ||
            step === "location" ||
            step === "details" ||
            step === "cleaner"
          ? WIZARD_SHELL_PB_DETAILS_STICKY
          : WIZARD_SHELL_PB_DEFAULT;

  return `${WIZARD_SHELL_WIDE_CLASS} ${paddingBottom}`;
}

export function getWizardShellClass(step: WizardStep): string {
  if (usesWideDesktopShell(step)) {
    return getWidePickerShellClass(
      step as
        | "service"
        | "datetime"
        | "location"
        | "details"
        | "cleaner"
        | "review"
        | "checkout",
    );
  }

  return [WIZARD_SHELL_BASE, WIZARD_SHELL_MAX_MOBILE, WIZARD_SHELL_PB_DEFAULT].join(" ");
}

export function getWizardCardClass(step: WizardStep): string {
  void step;
  return "w-full rounded-2xl border border-zinc-200 bg-white shadow-sm p-4 md:p-6";
}

/** Keeps stepper, card, and nav on the same horizontal track as the shell. */
export const WIZARD_MAIN_COLUMN_CLASS = "w-full min-w-0";

/** Aligns sticky footer controls with the wizard column on wide phones. */
export const WIZARD_STICKY_FOOTER_INNER_CLASS = "mx-auto w-full min-w-0 max-w-3xl";

/** Desktop nav rhythm aligned with wide picker steps (service through checkout). */
export function getWizardNavClass(step: WizardStep): string | undefined {
  if (
    step === "datetime" ||
    step === "location" ||
    step === "details" ||
    step === "cleaner" ||
    step === "review" ||
    step === "checkout"
  ) {
    return "mt-8 md:mt-6";
  }
  return undefined;
}
