import type { WizardStep } from "./types";
import { WIZARD_SHELL_BG } from "./wizardTheme";

/** Centered booking page shell shared across wizard steps. */
export const WIZARD_SHELL_BASE =
  `mx-auto flex min-h-screen w-full flex-col overflow-x-clip ${WIZARD_SHELL_BG} px-4 py-5 md:py-6`;

/** Primary picker and review steps. wide centered column. */
export const WIZARD_SHELL_MAX_DESKTOP = "max-w-3xl";

/** Literal wide shell for Tailwind scan + service/schedule parity (do not join dynamically). */
export const WIZARD_SHELL_WIDE_CLASS =
  `mx-auto flex min-h-screen w-full max-w-3xl flex-col overflow-x-clip ${WIZARD_SHELL_BG} px-4 py-5 md:py-6`;

/** Details/cleaner two-column layout. slightly wider for main + summary sidebar. */
export const WIZARD_SHELL_WIDE_WITH_SIDEBAR_CLASS =
  `mx-auto flex min-h-screen w-full max-w-5xl flex-col overflow-x-clip ${WIZARD_SHELL_BG} px-4 py-5 md:py-6`;

/** Fallback narrow column for steps outside the main seven-step flow. */
export const WIZARD_SHELL_MAX_MOBILE = "max-w-lg";

export const WIZARD_SHELL_PB_DEFAULT = "pb-24";

/** iOS home-indicator inset used in shell padding calcs. */
export const WIZARD_MOBILE_SAFE_AREA = "env(safe-area-inset-bottom,0px)";

/**
 * Sticky footer height budget (nav only): pt-2.5 + min-h-11 nav + pb safe ≈ 7.5rem.
 * Keep in sync with WIZARD_MOBILE_STICKY_FOOTER_CLASS vertical padding.
 */
export const WIZARD_MOBILE_STICKY_NAV_OFFSET_REM = "7.5rem";

/**
 * Sticky footer with compact summary row (review total / checkout trust): ≈ 9.25rem.
 */
export const WIZARD_MOBILE_STICKY_SUMMARY_OFFSET_REM = "9.25rem";

/** Service through cleaner: room for fixed mobile nav bar. */
export const WIZARD_SHELL_PB_NAV_STICKY = `pb-[calc(${WIZARD_MOBILE_STICKY_NAV_OFFSET_REM}+${WIZARD_MOBILE_SAFE_AREA})] md:pb-24`;

/** Review / checkout: room for fixed mobile summary + nav. */
export const WIZARD_SHELL_PB_SUMMARY_STICKY = `pb-[calc(${WIZARD_MOBILE_STICKY_SUMMARY_OFFSET_REM}+${WIZARD_MOBILE_SAFE_AREA})] md:pb-24`;

/** @deprecated Use WIZARD_SHELL_PB_NAV_STICKY */
export const WIZARD_SHELL_PB_SERVICE = WIZARD_SHELL_PB_NAV_STICKY;

/** @deprecated Use WIZARD_SHELL_PB_NAV_STICKY */
export const WIZARD_SHELL_PB_DETAILS_STICKY = WIZARD_SHELL_PB_NAV_STICKY;

/** Shared mobile sticky footer chrome (summary + nav); desktop stays in flow. */
export const WIZARD_MOBILE_STICKY_FOOTER_CLASS =
  "fixed inset-x-0 bottom-0 z-10 border-t border-slate-200/90 bg-shalean-surface/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur-sm md:static md:w-full md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:shadow-none md:backdrop-blur-none";

/** Slot above nav inside the sticky footer (commerce summary or trust row). */
export const WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS = "mb-1.5 md:hidden";

/** Nav rhythm when rendered inside the mobile sticky footer. */
export const WIZARD_NAV_IN_STICKY_FOOTER_CLASS = "mt-0 md:mt-6";

/** Scroll margin so focused inputs clear the sticky CTA on small screens. */
export const WIZARD_KEYBOARD_SCROLL_MARGIN_CLASS = "scroll-mb-[calc(7.5rem+env(safe-area-inset-bottom,0px))]";

/** Page title block below the stepper. */
export const WIZARD_PAGE_HEADER_CLASS = "mb-2.5 md:mb-3.5";

/** Context chip above step content (schedule through review). */
export const WIZARD_CONTEXT_STRIP_MB_CLASS = "mb-2.5 md:mb-3.5";

/** Reduces layout shift between wizard steps (presentation only). */
export const WIZARD_STEP_CARD_MIN_HEIGHT_CLASS = "min-h-[17rem] md:min-h-[18rem]";

/** Lightweight step content mount polish (no animation libraries). */
export const WIZARD_STEP_CONTENT_TRANSITION_CLASS =
  "transition-opacity duration-150 ease-out motion-reduce:transition-none";

const WIDE_DESKTOP_STEPS: WizardStep[] = [
  "service",
  "datetime",
  "location",
  "details",
  "cleaner",
  "review",
  "checkout",
];

const SUMMARY_STICKY_SHELL_STEPS: WizardStep[] = ["review", "checkout"];

const SIDEBAR_LAYOUT_STEPS: WizardStep[] = ["details", "cleaner"];

export function usesWideDesktopShell(step: WizardStep): boolean {
  return WIDE_DESKTOP_STEPS.includes(step);
}

/** All main booking steps use the same mobile-fixed footer pattern. */
export function usesWizardMobileStickyFooter(step: WizardStep): boolean {
  return usesWideDesktopShell(step);
}

function getWizardShellPaddingBottom(
  step:
    | "service"
    | "datetime"
    | "location"
    | "details"
    | "cleaner"
    | "review"
    | "checkout",
): string {
  if (SUMMARY_STICKY_SHELL_STEPS.includes(step)) {
    return WIZARD_SHELL_PB_SUMMARY_STICKY;
  }
  return WIZARD_SHELL_PB_NAV_STICKY;
}

export function usesWizardStepSummarySidebar(step: WizardStep): boolean {
  return SIDEBAR_LAYOUT_STEPS.includes(step);
}

/** Service through checkout share shell width; details/cleaner use a wider track for sidebar. */
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
  const shellBase = usesWizardStepSummarySidebar(step)
    ? WIZARD_SHELL_WIDE_WITH_SIDEBAR_CLASS
    : WIZARD_SHELL_WIDE_CLASS;
  return `${shellBase} ${getWizardShellPaddingBottom(step)}`;
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
  return `w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5 ${WIZARD_STEP_CARD_MIN_HEIGHT_CLASS}`;
}

/** Keeps stepper, card, and nav on the same horizontal track as the shell. */
export const WIZARD_MAIN_COLUMN_CLASS = "w-full min-w-0";

/** Aligns sticky footer controls with the wizard column on wide phones. */
export const WIZARD_STICKY_FOOTER_INNER_CLASS = "mx-auto w-full min-w-0 max-w-3xl";

export const WIZARD_STICKY_FOOTER_INNER_WITH_SIDEBAR_CLASS =
  "mx-auto w-full min-w-0 max-w-5xl";

export function getWizardStickyFooterInnerClass(step: WizardStep): string {
  return usesWizardStepSummarySidebar(step)
    ? WIZARD_STICKY_FOOTER_INNER_WITH_SIDEBAR_CLASS
    : WIZARD_STICKY_FOOTER_INNER_CLASS;
}

/** WizardNav className when paired with the mobile sticky footer. */
export function getWizardNavStickyClassName(): string {
  return `${WIZARD_MAIN_COLUMN_CLASS} ${WIZARD_NAV_IN_STICKY_FOOTER_CLASS}`;
}

/** Desktop nav rhythm aligned with wide picker steps (service through checkout). */
export function getWizardNavClass(step: WizardStep): string | undefined {
  if (usesWizardMobileStickyFooter(step) && step !== "service") {
    return "mt-8 md:mt-6";
  }
  return undefined;
}
