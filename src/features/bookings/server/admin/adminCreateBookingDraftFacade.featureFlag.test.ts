import { afterEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const isAdminAssistedBookingEnabledMock = vi.fn();

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => isAdminAssistedBookingEnabledMock(),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => {
    throw new Error("should not reach service role when feature disabled");
  },
}));

import { adminCreateBookingDraftFacade } from "./adminCreateBookingDraftFacade";

const adminUser: CurrentUser = {
  profileId: "admin-profile-1",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("adminCreateBookingDraftFacade feature flag", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when ADMIN_ASSISTED_BOOKING_ENABLED is off", async () => {
    isAdminAssistedBookingEnabledMock.mockReturnValue(false);
    const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

    const result = await adminCreateBookingDraftFacade({
      admin: adminUser,
      body: {
        customerId: "11111111-1111-4111-8111-111111111111",
        idempotencyKey: "flag-off-key",
        scheduledStart: start,
        scheduledEnd: end,
        pricingInput: {
          serviceSlug: "regular-cleaning",
          bedrooms: 2,
          bathrooms: 1,
          frequency: "once",
        },
        address: {
          addressLine1: "12 Main Rd",
          suburb: "Sea Point",
          city: "Cape Town",
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("FEATURE_DISABLED");
  });
});
