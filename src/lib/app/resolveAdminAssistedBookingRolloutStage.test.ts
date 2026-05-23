import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isInvalidAdminAssistedFlagCombination,
  resolveAdminAssistedBookingRolloutStage,
} from "./resolveAdminAssistedBookingRolloutStage";

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: vi.fn(() => false),
}));
vi.mock("@/lib/app/adminAssistedPaymentLinksFlag", () => ({
  isAdminAssistedPaymentLinksActive: vi.fn(() => false),
}));
vi.mock("@/lib/app/adminAssistedOfflinePaymentsFlag", () => ({
  isAdminAssistedOfflinePaymentsActive: vi.fn(() => false),
}));

describe("resolveAdminAssistedBookingRolloutStage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns disabled when booking flag is off", async () => {
    const { isAdminAssistedBookingEnabled } = await import("@/lib/app/adminAssistedBookingFlag");
    vi.mocked(isAdminAssistedBookingEnabled).mockReturnValue(false);
    expect(resolveAdminAssistedBookingRolloutStage()).toBe("disabled");
  });

  it("returns draft_only when links are off", async () => {
    const { isAdminAssistedBookingEnabled } = await import("@/lib/app/adminAssistedBookingFlag");
    vi.mocked(isAdminAssistedBookingEnabled).mockReturnValue(true);
    expect(resolveAdminAssistedBookingRolloutStage()).toBe("draft_only");
  });

  it("returns payment_links when offline is off", async () => {
    const { isAdminAssistedBookingEnabled } = await import("@/lib/app/adminAssistedBookingFlag");
    const { isAdminAssistedPaymentLinksActive } = await import(
      "@/lib/app/adminAssistedPaymentLinksFlag"
    );
    vi.mocked(isAdminAssistedBookingEnabled).mockReturnValue(true);
    vi.mocked(isAdminAssistedPaymentLinksActive).mockReturnValue(true);
    expect(resolveAdminAssistedBookingRolloutStage()).toBe("payment_links");
  });

  it("returns offline_eft when cash/card checklist items are incomplete", async () => {
    const { isAdminAssistedBookingEnabled } = await import("@/lib/app/adminAssistedBookingFlag");
    const { isAdminAssistedPaymentLinksActive } = await import(
      "@/lib/app/adminAssistedPaymentLinksFlag"
    );
    const { isAdminAssistedOfflinePaymentsActive } = await import(
      "@/lib/app/adminAssistedOfflinePaymentsFlag"
    );
    vi.mocked(isAdminAssistedBookingEnabled).mockReturnValue(true);
    vi.mocked(isAdminAssistedPaymentLinksActive).mockReturnValue(true);
    vi.mocked(isAdminAssistedOfflinePaymentsActive).mockReturnValue(true);

    expect(
      resolveAdminAssistedBookingRolloutStage([
        {
          checklistKey: "admin_assisted_offline_payment_cash_tested",
          completed: false,
        },
      ]),
    ).toBe("offline_eft");
  });

  it("returns offline_full when offline checklist is complete", async () => {
    const { isAdminAssistedBookingEnabled } = await import("@/lib/app/adminAssistedBookingFlag");
    const { isAdminAssistedPaymentLinksActive } = await import(
      "@/lib/app/adminAssistedPaymentLinksFlag"
    );
    const { isAdminAssistedOfflinePaymentsActive } = await import(
      "@/lib/app/adminAssistedOfflinePaymentsFlag"
    );
    vi.mocked(isAdminAssistedBookingEnabled).mockReturnValue(true);
    vi.mocked(isAdminAssistedPaymentLinksActive).mockReturnValue(true);
    vi.mocked(isAdminAssistedOfflinePaymentsActive).mockReturnValue(true);

    expect(
      resolveAdminAssistedBookingRolloutStage([
        {
          checklistKey: "admin_assisted_offline_payment_cash_tested",
          completed: true,
        },
        {
          checklistKey: "admin_assisted_offline_payment_card_machine_tested",
          completed: true,
        },
      ]),
    ).toBe("offline_full");
  });

  it("detects invalid flag combinations", async () => {
    const { isAdminAssistedBookingEnabled } = await import("@/lib/app/adminAssistedBookingFlag");
    const { isAdminAssistedPaymentLinksActive } = await import(
      "@/lib/app/adminAssistedPaymentLinksFlag"
    );
    vi.mocked(isAdminAssistedBookingEnabled).mockReturnValue(false);
    vi.mocked(isAdminAssistedPaymentLinksActive).mockReturnValue(true);
    expect(isInvalidAdminAssistedFlagCombination()).toContain("without ADMIN_ASSISTED_BOOKING_ENABLED");
  });
});
