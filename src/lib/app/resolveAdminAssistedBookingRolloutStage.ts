import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";
import { isAdminAssistedOfflinePaymentsActive } from "@/lib/app/adminAssistedOfflinePaymentsFlag";
import { isAdminAssistedPaymentLinksActive } from "@/lib/app/adminAssistedPaymentLinksFlag";

export type AdminAssistedBookingRolloutStage =
  | "disabled"
  | "draft_only"
  | "payment_links"
  | "offline_eft"
  | "offline_full";

export type AdminAssistedRolloutChecklistSnapshot = {
  checklistKey: string;
  completed: boolean;
};

const OFFLINE_FULL_CHECKLIST_KEYS = [
  "admin_assisted_offline_payment_cash_tested",
  "admin_assisted_offline_payment_card_machine_tested",
] as const;

export const ADMIN_ASSISTED_ROLLOUT_STAGE_LABELS: Record<AdminAssistedBookingRolloutStage, string> = {
  disabled: "Disabled",
  draft_only: "Draft + pending only",
  payment_links: "Payment links enabled",
  offline_eft: "Offline EFT pilot",
  offline_full: "Offline full (EFT + cash + card)",
};

export const ADMIN_ASSISTED_ROLLOUT_STAGE_DESCRIPTIONS: Record<
  AdminAssistedBookingRolloutStage,
  string
> = {
  disabled: "Admin-assisted booking mutations are off. Preview wizard only.",
  draft_only: "Draft and pending-payment creation enabled. Paystack links and offline rails off.",
  payment_links:
    "Paystack payment links and payment-request notifications enabled. Offline rails off.",
  offline_eft:
    "Offline EFT recording enabled. Cash/card machine require checklist sign-off before full offline.",
  offline_full: "All offline payment rails enabled per production checklist.",
};

/**
 * Derives the effective rollout stage from existing env flags and optional checklist snapshot.
 * Does not mutate flags — interpretation only.
 */
export function resolveAdminAssistedBookingRolloutStage(
  checklist?: readonly AdminAssistedRolloutChecklistSnapshot[],
): AdminAssistedBookingRolloutStage {
  if (!isAdminAssistedBookingEnabled()) {
    return "disabled";
  }

  if (!isAdminAssistedPaymentLinksActive()) {
    return "draft_only";
  }

  if (!isAdminAssistedOfflinePaymentsActive()) {
    return "payment_links";
  }

  if (checklist?.length) {
    const incompleteFullOffline = OFFLINE_FULL_CHECKLIST_KEYS.some(
      (key) => !checklist.find((item) => item.checklistKey === key)?.completed,
    );
    if (incompleteFullOffline) {
      return "offline_eft";
    }
  }

  return "offline_full";
}

export function isInvalidAdminAssistedFlagCombination(): string | null {
  const booking = isAdminAssistedBookingEnabled();
  const links = isAdminAssistedPaymentLinksActive();
  const offline = isAdminAssistedOfflinePaymentsActive();

  if (!booking && (links || offline)) {
    return "Payment links or offline payments are enabled without ADMIN_ASSISTED_BOOKING_ENABLED.";
  }

  if (offline && !links) {
    return "Offline payments require payment links to be active (both flags on with booking enabled).";
  }

  return null;
}
