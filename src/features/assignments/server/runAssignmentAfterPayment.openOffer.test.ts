import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { buildOfferExpiresAt } from "./buildOfferExpiry";
import { runAssignmentAfterPayment } from "./runAssignmentAfterPayment";
import type { AssignmentContext } from "./types";

const eligibilityMock = vi.hoisted(() => ({
  isCleanerEligibleForAssignment: vi.fn(),
  pickBestEligibleCleanerId: vi.fn(),
}));

vi.mock("./eligibilityForAssignment", () => eligibilityMock);

vi.mock("./assignmentContext", () => ({
  loadAssignmentContext: vi.fn(),
}));

import { loadAssignmentContext } from "./assignmentContext";

const systemActor = { actorType: "system" as const, profileId: null };
const customerId = "customer-open-offer";
const cleanerA = "cleaner-a";
const cleanerB = "cleaner-b";

let backend: InMemoryBookingCommandBackend;

function createOffersClient(
  backend: InMemoryBookingCommandBackend,
): SupabaseClient<import("@/lib/database/types").Database> {
  return {
    from(table: string) {
      if (table === "assignment_offers") {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              order: async () => {
                const rows = [...backend.offers.values()].filter((o) => o.booking_id === val);
                return { data: rows, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<import("@/lib/database/types").Database>;
}

function mockAssignmentContext(bookingId: string): AssignmentContext {
  return {
    bookingId,
    scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
    scheduledEnd: new Date(Date.now() + 90_000_000).toISOString(),
    scheduleTimezone: "Africa/Johannesburg",
    areaSlug: "cape-town",
    serviceSlug: "regular-cleaning",
    cleanerPreference: { mode: "best_available", selectedCleanerId: null },
    preferredCleanerId: null,
    pricingInput: { serviceSlug: "regular-cleaning", bedrooms: 2, bathrooms: 1, teamSize: 1 },
  };
}

async function seedPendingAssignmentWithStaleOffer(
  bookingId: string,
): Promise<void> {
  const ts = new Date().toISOString();
  await backend.insertBooking({
    id: bookingId,
    customer_id: customerId,
    cleaner_id: null,
    service_id: null,
    status: "pending_assignment",
    scheduled_start: new Date(Date.now() + 86_400_000).toISOString(),
    scheduled_end: new Date(Date.now() + 90_000_000).toISOString(),
    price_cents: 50_000,
    currency: "ZAR",
    series_id: null,
    metadata: {
      assignment: { status: "offered", path: "best_available", cleanerId: cleanerA },
    },
    created_at: ts,
    updated_at: ts,
  });
  await backend.insertOffer({
    id: "stale-offer",
    booking_id: bookingId,
    cleaner_id: cleanerA,
    status: "offered",
    offered_at: new Date(Date.now() - 72 * 3600_000).toISOString(),
    responded_at: null,
    expires_at: new Date(Date.now() - 3600_000).toISOString(),
    created_at: ts,
    updated_at: ts,
  });
}

beforeEach(() => {
  backend = new InMemoryBookingCommandBackend();
  vi.mocked(loadAssignmentContext).mockReset();
  eligibilityMock.pickBestEligibleCleanerId.mockReset();
  eligibilityMock.pickBestEligibleCleanerId.mockResolvedValue(cleanerB);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("runAssignmentAfterPayment open-offer semantics (Stage 3C-a)", () => {
  it("does not treat past-expiry offered row as blocking dispatch", async () => {
    const bookingId = "booking-stale-offer";
    await seedPendingAssignmentWithStaleOffer(bookingId);
    vi.mocked(loadAssignmentContext).mockResolvedValue(mockAssignmentContext(bookingId));

    const client = createOffersClient(backend);
    const result = await runAssignmentAfterPayment(client, backend, bookingId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("offered");
    expect(result.cleanerId).toBe(cleanerB);
    const openOffers = [...backend.offers.values()].filter((o) => o.status === "offered");
    expect(openOffers).toHaveLength(1);
    expect(openOffers[0]?.cleaner_id).toBe(cleanerB);
  });

  it("short-circuits when an ops-open offer exists", async () => {
    const bookingId = "booking-active-offer";
    const ts = new Date().toISOString();
    await backend.insertBooking({
      id: bookingId,
      customer_id: customerId,
      cleaner_id: null,
      service_id: null,
      status: "pending_assignment",
      scheduled_start: new Date(Date.now() + 86_400_000).toISOString(),
      scheduled_end: new Date(Date.now() + 90_000_000).toISOString(),
      price_cents: 50_000,
      currency: "ZAR",
      series_id: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });
    await backend.insertOffer({
      id: "active-offer",
      booking_id: bookingId,
      cleaner_id: cleanerA,
      status: "offered",
      offered_at: ts,
      responded_at: null,
      expires_at: buildOfferExpiresAt(),
      created_at: ts,
      updated_at: ts,
    });

    const client = createOffersClient(backend);
    const result = await runAssignmentAfterPayment(client, backend, bookingId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcome).toBe("offered");
    expect(result.offerId).toBe("active-offer");
    expect([...backend.offers.values()].filter((o) => o.status === "offered")).toHaveLength(1);
    expect(eligibilityMock.pickBestEligibleCleanerId).not.toHaveBeenCalled();
  });
});
