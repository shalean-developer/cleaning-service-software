import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: vi.fn(),
}));

vi.mock("./assignmentContext", () => ({
  loadAssignmentContext: vi.fn(),
}));

vi.mock("./eligibilityForAssignment", () => ({
  isCleanerEligibleForAssignment: vi.fn(),
}));

vi.mock("./offerRepository", () => ({
  listOffersForBooking: vi.fn(),
}));

vi.mock("./createAdminSupportDispatchOffer", () => ({
  createAdminSupportDispatchOffer: vi.fn(),
}));

import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { loadAssignmentContext } from "./assignmentContext";
import { isCleanerEligibleForAssignment } from "./eligibilityForAssignment";
import { listOffersForBooking } from "./offerRepository";
import { createAdminSupportDispatchOffer } from "./createAdminSupportDispatchOffer";
import { runAdminSupportDispatchOffer } from "./adminSupportDispatchOffer";

const adminUser: CurrentUser = {
  profileId: "admin-profile",
  role: "admin",
  email: "admin@test.com",
};

function mockBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    customer_id: "cust-1",
    cleaner_id: "primary-cleaner",
    service_id: null,
    status: "assigned",
    scheduled_start: new Date().toISOString(),
    scheduled_end: new Date().toISOString(),
    price_cents: 10_000,
    currency: "ZAR",
    series_id: null,
    metadata: {
      serviceSlug: "regular-cleaning",
      quote: {
        input: {
          serviceSlug: "regular-cleaning",
          requestedTeamSize: 2,
          teamSize: 1,
        },
      },
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("runAdminSupportDispatchOffer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("TEAM_OFFERS_ENABLED", "true");
  });

  it("rejects when TEAM_OFFERS_ENABLED is false", async () => {
    vi.stubEnv("TEAM_OFFERS_ENABLED", "false");
    const result = await runAdminSupportDispatchOffer(adminUser, "booking-1", {
      cleanerId: "support-cleaner",
      reason: "Need second cleaner for large home visit today",
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.code).toBe("TEAM_OFFERS_DISABLED");
  });

  it("creates support offer and roster when eligible", async () => {
    const booking = mockBooking();
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: booking, error: null }),
          })),
        })),
      })),
    };
    vi.mocked(createServiceRoleClient).mockReturnValue(client as never);
    vi.mocked(createBookingCommandBackend).mockReturnValue({} as never);
    vi.mocked(listOffersForBooking).mockResolvedValue([]);
    vi.mocked(loadAssignmentContext).mockResolvedValue({
      bookingId: booking.id,
      scheduledStart: booking.scheduled_start,
      scheduledEnd: booking.scheduled_end,
      scheduleTimezone: "Africa/Johannesburg",
      areaSlug: "cape-town",
      serviceSlug: "regular-cleaning",
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        teamSize: 2,
        requestedTeamSize: 2,
      },
      cleanerPreference: { mode: "best_available", selectedCleanerId: null },
      preferredCleanerId: null,
    });
    vi.mocked(isCleanerEligibleForAssignment).mockResolvedValue(true);
    vi.mocked(createAdminSupportDispatchOffer).mockResolvedValue({
      ok: true,
      bookingId: booking.id,
      status: "pending_assignment",
      idempotent: false,
      offerId: "offer-support-1",
    });

    const result = await runAdminSupportDispatchOffer(adminUser, booking.id, {
      cleanerId: "support-cleaner",
      reason: "Customer requested two cleaners; add support slot",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.status).toBe("offered");
    expect(createAdminSupportDispatchOffer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        bookingId: booking.id,
        cleanerId: "support-cleaner",
      }),
    );
  });
});
