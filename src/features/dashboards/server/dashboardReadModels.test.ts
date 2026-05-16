import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const getCurrentUserMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();
const resolveActorScopeMock = vi.fn();
const getCleanerOffersMock = vi.fn();
const getOfferByIdMock = vi.fn();
const acceptCleanerOfferMock = vi.fn();

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: (...args: unknown[]) => resolveActorScopeMock(...args),
}));

vi.mock("@/features/assignments/server/getCleanerOffers", () => ({
  getCleanerOffers: (...args: unknown[]) => getCleanerOffersMock(...args),
}));

vi.mock("@/features/assignments/server/offerRepository", () => ({
  getOfferById: (...args: unknown[]) => getOfferByIdMock(...args),
}));

vi.mock("@/features/assignments/server/respondToOffer", () => ({
  acceptCleanerOffer: (...args: unknown[]) => acceptCleanerOfferMock(...args),
}));

vi.mock("@/features/bookings/server/commands/runBookingCommand", () => ({
  createBookingCommandBackend: () => ({}),
}));

const customerUser: CurrentUser = {
  profileId: "profile-customer",
  role: "customer",
  authUser: { id: "auth-customer" } as CurrentUser["authUser"],
};

const cleanerUser: CurrentUser = {
  profileId: "profile-cleaner",
  role: "cleaner",
  authUser: { id: "auth-cleaner" } as CurrentUser["authUser"],
};

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

/** Production-shaped wizard metadata (slug under quote.input, not top-level). */
function wizardBookingMetadata(serviceSlug: string) {
  return {
    quote: { input: { serviceSlug, bedrooms: 2, bathrooms: 1, teamSize: 1 } },
    suburb: "Sea Point",
  };
}

function chainable(rows: unknown[] | unknown | null, error: unknown = null) {
  const result = { data: rows, error };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () =>
      Array.isArray(rows) ? { data: rows[0] ?? null, error } : { data: rows, error },
    ),
    then: undefined as unknown,
  };
  (builder as { then: (onFulfilled: (v: typeof result) => unknown) => Promise<unknown> }).then = (
    onFulfilled,
  ) => Promise.resolve(result).then(onFulfilled);
  return builder;
}

describe("dashboard read models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveActorScopeMock.mockResolvedValue({
      actingCustomerId: "cust-1",
      actingCleanerId: "cleaner-1",
    });
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return chainable([
            {
              id: "booking-1",
              status: "pending_assignment",
              customer_id: "cust-1",
              cleaner_id: null,
              scheduled_start: "2026-05-20T08:00:00.000Z",
              scheduled_end: "2026-05-20T10:00:00.000Z",
              price_cents: 50000,
              currency: "ZAR",
              metadata: wizardBookingMetadata("deep-cleaning"),
              updated_at: "2026-05-16T10:00:00.000Z",
              created_at: "2026-05-16T09:00:00.000Z",
            },
          ]);
        }
        if (table === "payments") return chainable([]);
        if (table === "booking_state_audit") return chainable([]);
        if (table === "assignment_offers") return chainable([]);
        if (table === "customers") return chainable({ company_name: "Acme Co" });
        if (table === "cleaners") return chainable({ profile_id: "profile-cleaner-b" });
        if (table === "profiles") return chainable({ full_name: "Sam Cleaner" });
        if (table === "payment_events") return chainable([]);
        return chainable([]);
      }),
    });
  });

  it("customer sees own bookings only", async () => {
    const { listCustomerBookings } = await import("./customerBookingReadModel");
    const result = await listCustomerBookings(customerUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bookings).toHaveLength(1);
      expect(result.bookings[0]?.id).toBe("booking-1");
      expect(result.bookings[0]?.display.serviceLabel).toBe("Deep Cleaning");
    }
  });

  it("customer cannot see another customer's booking", async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return chainable({
            id: "booking-other",
            status: "confirmed",
            customer_id: "cust-other",
            cleaner_id: null,
            scheduled_start: "2026-05-20T08:00:00.000Z",
            scheduled_end: "2026-05-20T10:00:00.000Z",
            price_cents: 50000,
            currency: "ZAR",
            metadata: {},
            created_at: "2026-05-16T09:00:00.000Z",
            updated_at: "2026-05-16T10:00:00.000Z",
          });
        }
        if (table === "payments") return chainable([]);
        if (table === "booking_state_audit") return chainable([]);
        return chainable([]);
      }),
    };
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { getCustomerBookingDetail } = await import("./customerBookingReadModel");
    const result = await getCustomerBookingDetail(customerUser, "booking-other");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("customer booking list items do not expose admin-only fields", async () => {
    const { listCustomerBookings } = await import("./customerBookingReadModel");
    const result = await listCustomerBookings(customerUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const item = result.bookings[0]!;
      expect(item).not.toHaveProperty("customerId");
      expect(item).not.toHaveProperty("metadata");
      expect(JSON.stringify(item)).not.toContain("cust-1");
    }
  });

  it("cleaner offers show earnings preview, not customer total", async () => {
    getCleanerOffersMock.mockResolvedValue({
      ok: true,
      offers: [
        {
          offer: {
            id: "offer-1",
            status: "offered",
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            offered_at: new Date().toISOString(),
          },
          booking: {
            id: "booking-1",
            scheduled_start: "2026-05-20T08:00:00.000Z",
            scheduled_end: "2026-05-20T10:00:00.000Z",
            price_cents: 150_000,
            currency: "ZAR",
          },
        },
      ],
    });

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return chainable({
            metadata: {
              quote: {
                input: {
                  serviceSlug: "deep-cleaning",
                  bedrooms: 2,
                  bathrooms: 1,
                  teamSize: 1,
                },
                cleanerEarningsPreview: {
                  perCleanerAmountCents: 25_000,
                  teamSize: 1,
                  totalCleanerPayoutCents: 25_000,
                  ruleApplied: "fixed_per_cleaner_deep_moving_carpet",
                  metadata: {},
                },
              },
            },
          });
        }
        return chainable([]);
      }),
    });

    const { listCleanerOffersForDashboard } = await import("./cleanerJobReadModel");
    const { formatZar } = await import("./parseBookingDisplay");
    const result = await listCleanerOffersForDashboard(cleanerUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offers).toHaveLength(1);
      expect(result.offers[0]?.offerId).toBe("offer-1");
      expect(result.offers[0]?.earningsCents).toBe(25_000);
      expect(result.offers[0]?.earningsLabel).toBe(formatZar(25_000));
      expect(result.offers[0]?.earningsLabel).not.toBe(formatZar(150_000));
      expect(result.offers[0]).not.toHaveProperty("priceLabel");
    }
  });

  it("cleaner sees assigned jobs for linked cleaner profile", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return chainable([
            {
              id: "job-1",
              status: "assigned",
              scheduled_start: "2026-05-20T08:00:00.000Z",
              scheduled_end: "2026-05-20T10:00:00.000Z",
              price_cents: 50000,
              currency: "ZAR",
              metadata: wizardBookingMetadata("airbnb-cleaning"),
              updated_at: "2026-05-16T10:00:00.000Z",
            },
          ]);
        }
        return chainable([]);
      }),
    });

    const { listCleanerJobs } = await import("./cleanerJobReadModel");
    const result = await listCleanerJobs(cleanerUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0]?.bookingId).toBe("job-1");
      expect(result.jobs[0]?.serviceLabel).toBe("Airbnb Cleaning");
    }
    expect(resolveActorScopeMock).toHaveBeenCalled();
  });

  it("cleaner job detail omits customer total fields", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return chainable({
            id: "job-1",
            status: "assigned",
            scheduled_start: "2026-05-20T08:00:00.000Z",
            scheduled_end: "2026-05-20T10:00:00.000Z",
            price_cents: 150_000,
            currency: "ZAR",
            metadata: {
              quote: {
                input: {
                  serviceSlug: "deep-cleaning",
                  bedrooms: 2,
                  bathrooms: 1,
                  teamSize: 1,
                },
                cleanerEarningsPreview: {
                  perCleanerAmountCents: 25_000,
                  teamSize: 1,
                  totalCleanerPayoutCents: 25_000,
                  ruleApplied: "fixed_per_cleaner_deep_moving_carpet",
                  metadata: {},
                },
              },
            },
            created_at: "2026-05-16T09:00:00.000Z",
            updated_at: "2026-05-16T10:00:00.000Z",
            cleaner_id: "cleaner-1",
          });
        }
        if (table === "booking_state_audit") return chainable([]);
        if (table === "earning_lines") return chainable([]);
        return chainable([]);
      }),
    });

    const { getCleanerJobDetail } = await import("./cleanerJobReadModel");
    const { formatZar } = await import("./parseBookingDisplay");
    const { collectForbiddenCleanerApiKeys } = await import("./cleanerApiPayload");
    const result = await getCleanerJobDetail(cleanerUser, "job-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.job.earningsCents).toBe(25_000);
      expect(result.job.earningsLabel).toBe(formatZar(25_000));
      expect(result.job.earningsLabel).not.toBe(formatZar(150_000));
      expect(result.job).not.toHaveProperty("priceLabel");
      expect(collectForbiddenCleanerApiKeys({ job: result.job })).toEqual([]);
    }
  });

  it("cleaner cannot load another cleaner job detail", async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return chainable({
            id: "job-other",
            status: "assigned",
            scheduled_start: "2026-05-20T08:00:00.000Z",
            scheduled_end: "2026-05-20T10:00:00.000Z",
            price_cents: 50000,
            currency: "ZAR",
            metadata: {},
            created_at: "2026-05-16T09:00:00.000Z",
            updated_at: "2026-05-16T10:00:00.000Z",
            cleaner_id: "cleaner-other",
          });
        }
        return chainable([]);
      }),
    };
    createSupabaseServerClientMock.mockResolvedValue(client);

    const { getCleanerJobDetail } = await import("./cleanerJobReadModel");
    const result = await getCleanerJobDetail(cleanerUser, "job-other");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("admin sees all bookings", async () => {
    const { listAdminBookings } = await import("./adminOperationsReadModel");
    const result = await listAdminBookings(adminUser);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bookings.length).toBeGreaterThan(0);
  });

  it("admin sees assignment attention queue", async () => {
    const { listAdminAssignmentQueue } = await import("./adminOperationsReadModel");
    const result = await listAdminAssignmentQueue(adminUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.items)).toBe(true);
      if (result.items.length > 0) {
        expect(result.items[0]?.serviceLabel).toBe("Deep Cleaning");
      }
    }
  });

  it("cleaner can accept own offer through API", async () => {
    getCurrentUserMock.mockResolvedValue(cleanerUser);

    getOfferByIdMock.mockResolvedValue({
      id: "offer-1",
      cleaner_id: "cleaner-1",
      booking_id: "booking-1",
      status: "offered",
    });
    acceptCleanerOfferMock.mockResolvedValue({
      ok: true,
      bookingId: "booking-1",
      status: "assigned",
      idempotent: false,
    });

    const { POST } = await import("@/app/api/cleaner/offers/[offerId]/accept/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ offerId: "offer-1" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(acceptCleanerOfferMock).toHaveBeenCalled();
  });

  it("cleaner cannot accept another cleaner offer through API", async () => {
    getCurrentUserMock.mockResolvedValue(cleanerUser);

    getOfferByIdMock.mockResolvedValue({
      id: "offer-2",
      cleaner_id: "cleaner-other",
      booking_id: "booking-1",
      status: "offered",
    });
    acceptCleanerOfferMock.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      message: "Offer belongs to another cleaner.",
    });

    const { POST } = await import("@/app/api/cleaner/offers/[offerId]/accept/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ offerId: "offer-2" }),
    });
    expect(response.status).toBe(403);
  });
});
