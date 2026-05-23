import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateAdminAssistedRolloutReadiness } from "./adminAssistedRolloutReadiness";
import type { ProductionRolloutChecklistItem } from "@/features/production-rollout/server/productionRolloutTypes";
import { ADMIN_ASSISTED_CRITICAL_CHECKLIST_KEYS } from "./adminAssistedRolloutReadiness";

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: vi.fn(() => true),
}));
vi.mock("@/lib/app/adminAssistedPaymentLinksFlag", () => ({
  isAdminAssistedPaymentLinksActive: vi.fn(() => true),
}));
vi.mock("@/lib/app/adminAssistedOfflinePaymentsFlag", () => ({
  isAdminAssistedOfflinePaymentsActive: vi.fn(() => true),
}));

function assistItem(
  checklistKey: string,
  completed: boolean,
  label = checklistKey,
): ProductionRolloutChecklistItem {
  return {
    id: checklistKey,
    checklistKey,
    label,
    category: "admin_assisted_booking",
    completed,
    completedBy: completed ? "admin@test.com" : null,
    completedAt: completed ? "2026-05-23T10:00:00.000Z" : null,
    notes: null,
    createdAt: "2026-05-01T00:00:00.000Z",
  };
}

describe("evaluateAdminAssistedRolloutReadiness", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("derives production-ready when all critical items are complete", () => {
    const checklist = ADMIN_ASSISTED_CRITICAL_CHECKLIST_KEYS.map((key) => assistItem(key, true));
    checklist.push(
      assistItem("admin_assisted_offline_payment_cash_tested", true),
      assistItem("admin_assisted_offline_payment_card_machine_tested", true),
    );

    const readiness = evaluateAdminAssistedRolloutReadiness(checklist);
    expect(readiness.productionReady).toBe(true);
    expect(readiness.unresolvedBlockers).toHaveLength(0);
    expect(readiness.criticalProgress.percent).toBe(100);
    expect(readiness.lastVerifiedBy).toBe("admin@test.com");
  });

  it("lists unresolved blockers and marks not production-ready", () => {
    const checklist = [assistItem("admin_assisted_booking_draft_tested", false, "Draft tested")];
    const readiness = evaluateAdminAssistedRolloutReadiness(checklist);
    expect(readiness.productionReady).toBe(false);
    expect(readiness.unresolvedBlockers.length).toBeGreaterThan(0);
    expect(readiness.unresolvedBlockers[0]).toBe("Draft tested");
  });
});
