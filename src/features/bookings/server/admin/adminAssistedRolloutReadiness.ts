import type { ProductionRolloutChecklistItem } from "@/features/production-rollout/server/productionRolloutTypes";
import {
  ADMIN_ASSISTED_ROLLOUT_STAGE_DESCRIPTIONS,
  ADMIN_ASSISTED_ROLLOUT_STAGE_LABELS,
  resolveAdminAssistedBookingRolloutStage,
  type AdminAssistedBookingRolloutStage,
} from "@/lib/app/resolveAdminAssistedBookingRolloutStage";

export const ADMIN_ASSISTED_PRODUCTION_CHECKLIST_KEYS = [
  "admin_assisted_booking_draft_tested",
  "admin_assisted_pending_payment_tested",
  "admin_assisted_payment_link_tested",
  "admin_assisted_payment_request_email_tested",
  "admin_assisted_offline_payment_eft_tested",
  "admin_assisted_offline_payment_cash_tested",
  "admin_assisted_offline_payment_card_machine_tested",
  "admin_assisted_assignment_parity_verified",
  "admin_assisted_customer_visibility_verified",
  "admin_assisted_cleaner_visibility_verified",
  "admin_assisted_payout_safety_verified",
  "admin_assisted_webhook_parity_verified",
  "admin_assisted_feature_flags_verified",
] as const;

/** Minimum checklist items before declaring production-ready (offline cash/card optional for EFT stage). */
export const ADMIN_ASSISTED_CRITICAL_CHECKLIST_KEYS = [
  "admin_assisted_booking_draft_tested",
  "admin_assisted_pending_payment_tested",
  "admin_assisted_payment_link_tested",
  "admin_assisted_payment_request_email_tested",
  "admin_assisted_offline_payment_eft_tested",
  "admin_assisted_assignment_parity_verified",
  "admin_assisted_customer_visibility_verified",
  "admin_assisted_cleaner_visibility_verified",
  "admin_assisted_payout_safety_verified",
  "admin_assisted_webhook_parity_verified",
  "admin_assisted_feature_flags_verified",
] as const;

export type AdminAssistedRolloutReadiness = {
  rolloutStage: AdminAssistedBookingRolloutStage;
  rolloutStageLabel: string;
  rolloutStageDescription: string;
  checklistProgress: {
    completed: number;
    total: number;
    percent: number;
  };
  criticalProgress: {
    completed: number;
    total: number;
    percent: number;
  };
  unresolvedBlockers: string[];
  productionReady: boolean;
  lastVerifiedAt: string | null;
  lastVerifiedBy: string | null;
};

function adminAssistChecklistItems(
  checklist: ProductionRolloutChecklistItem[],
): ProductionRolloutChecklistItem[] {
  return checklist.filter((item) => item.category === "admin_assisted_booking");
}

function isCompleted(
  checklist: ProductionRolloutChecklistItem[],
  key: string,
): boolean {
  return checklist.find((item) => item.checklistKey === key)?.completed ?? false;
}

export function evaluateAdminAssistedRolloutReadiness(
  checklist: ProductionRolloutChecklistItem[],
): AdminAssistedRolloutReadiness {
  const assistItems = adminAssistChecklistItems(checklist);
  const completed = assistItems.filter((item) => item.completed);
  const total = assistItems.length;

  const criticalCompleted = ADMIN_ASSISTED_CRITICAL_CHECKLIST_KEYS.filter((key) =>
    isCompleted(checklist, key),
  ).length;
  const criticalTotal = ADMIN_ASSISTED_CRITICAL_CHECKLIST_KEYS.length;

  const unresolvedBlockers: string[] = [];
  for (const key of ADMIN_ASSISTED_CRITICAL_CHECKLIST_KEYS) {
    if (!isCompleted(checklist, key)) {
      const label = checklist.find((item) => item.checklistKey === key)?.label ?? key;
      unresolvedBlockers.push(label);
    }
  }

  const lastCompleted = [...completed]
    .filter((item) => item.completedAt)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];

  const rolloutStage = resolveAdminAssistedBookingRolloutStage(
    checklist.map((item) => ({ checklistKey: item.checklistKey, completed: item.completed })),
  );

  const productionReady =
    criticalCompleted === criticalTotal &&
    rolloutStage !== "disabled" &&
    unresolvedBlockers.length === 0;

  return {
    rolloutStage,
    rolloutStageLabel: ADMIN_ASSISTED_ROLLOUT_STAGE_LABELS[rolloutStage],
    rolloutStageDescription: ADMIN_ASSISTED_ROLLOUT_STAGE_DESCRIPTIONS[rolloutStage],
    checklistProgress: {
      completed: completed.length,
      total,
      percent: total > 0 ? Math.round((completed.length / total) * 100) : 0,
    },
    criticalProgress: {
      completed: criticalCompleted,
      total: criticalTotal,
      percent: Math.round((criticalCompleted / criticalTotal) * 100),
    },
    unresolvedBlockers,
    productionReady,
    lastVerifiedAt: lastCompleted?.completedAt ?? null,
    lastVerifiedBy: lastCompleted?.completedBy ?? null,
  };
}
