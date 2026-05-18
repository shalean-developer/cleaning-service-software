import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const isTeamOffersEnabledMock = vi.fn(() => true);
const getCleanerOffersMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();
const resolveActorScopeMock = vi.fn();

vi.mock("@/features/assignments/server/teamOffersConfig", () => ({
  isTeamOffersEnabled: () => isTeamOffersEnabledMock(),
}));

vi.mock("@/features/assignments/server/getCleanerOffers", () => ({
  getCleanerOffers: (...args: unknown[]) => getCleanerOffersMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: (...args: unknown[]) => resolveActorScopeMock(...args),
}));

const cleanerUser: CurrentUser = {
  profileId: "profile-cleaner",
  role: "cleaner",
  authUser: { id: "auth-cleaner" } as CurrentUser["authUser"],
};

function wizardMetadata() {
  return {
    quote: { input: { serviceSlug: "deep-cleaning", bedrooms: 2, bathrooms: 1, teamSize: 2 } },
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

describe("cleanerJobReadModel team visibility (NF-7E)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTeamOffersEnabledMock.mockReturnValue(true);
    resolveActorScopeMock.mockResolvedValue({ actingCleanerId: "cleaner-lead" });
  });

  it("lead cleaner still sees jobs keyed by bookings.cleaner_id", async () => {
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          return chainable([
            {
              id: "job-lead",
              status: "assigned",
              scheduled_start: "2026-05-20T08:00:00.000Z",
              scheduled_end: "2026-05-20T10:00:00.000Z",
              price_cents: 50_000,
              currency: "ZAR",
              metadata: wizardMetadata(),
              updated_at: "2026-05-16T10:00:00.000Z",
              cleaner_id: "cleaner-lead",
            },
          ]);
        }
        if (table === "booking_cleaners") return chainable([]);
        return chainable([]);
      }),
    });

    const { listCleanerJobs } = await import("./cleanerJobReadModel");
    const result = await listCleanerJobs(cleanerUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0]?.teamRoleLabel).toBe("Lead cleaner");
    }
  });

  it("support cleaner sees accepted roster job without becoming cleaner_id", async () => {
    resolveActorScopeMock.mockResolvedValue({ actingCleanerId: "cleaner-support" });

    const supportBooking = {
      id: "job-team",
      status: "assigned",
      scheduled_start: "2026-05-20T08:00:00.000Z",
      scheduled_end: "2026-05-20T10:00:00.000Z",
      price_cents: 50_000,
      currency: "ZAR",
      metadata: wizardMetadata(),
      updated_at: "2026-05-16T10:00:00.000Z",
      cleaner_id: "cleaner-lead",
    };

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "bookings") {
          const inCalls: unknown[][] = [];
          const builder = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            in: vi.fn((_col: string, values: unknown[]) => {
              inCalls.push(values);
              return builder;
            }),
            order: vi.fn(() => builder),
            then: (onFulfilled: (v: { data: unknown; error: null }) => unknown) => {
              const isSupportFetch =
                inCalls.length >= 2 && inCalls.some((v) => Array.isArray(v) && v.includes("job-team"));
              return Promise.resolve({
                data: isSupportFetch ? [supportBooking] : [],
                error: null,
              }).then(onFulfilled);
            },
          };
          return builder;
        }
        if (table === "booking_cleaners") {
          return chainable([{ booking_id: "job-team" }]);
        }
        return chainable([]);
      }),
    });

    const { listCleanerJobs } = await import("./cleanerJobReadModel");
    const result = await listCleanerJobs(cleanerUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jobs.some((j) => j.bookingId === "job-team")).toBe(true);
      const supportJob = result.jobs.find((j) => j.bookingId === "job-team");
      expect(supportJob?.teamRoleLabel).toBe("Support cleaner");
      expect(supportJob?.earningsCents).toBeNull();
    }
  });

  it("support cleaner sees support offer with role label and neutral earnings", async () => {
    getCleanerOffersMock.mockResolvedValue({
      ok: true,
      offers: [
        {
          offer: {
            id: "offer-support",
            status: "offered",
            expires_at: new Date(Date.now() + 3600000).toISOString(),
            offered_at: new Date().toISOString(),
            team_role: "support",
          },
          booking: {
            id: "job-team",
            scheduled_start: "2026-05-20T08:00:00.000Z",
            scheduled_end: "2026-05-20T10:00:00.000Z",
            status: "assigned",
            price_cents: 50_000,
            currency: "ZAR",
          },
        },
      ],
    });
    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() =>
        chainable({ metadata: wizardMetadata() }),
      ),
    });

    const { listCleanerOffersForDashboard } = await import("./cleanerJobReadModel");
    const { SUPPORT_CLEANER_EARNINGS_LABEL } = await import("./cleanerTeamJobVisibility");
    const result = await listCleanerOffersForDashboard(cleanerUser);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.offers[0]?.teamRoleLabel).toBe("Support cleaner");
      expect(result.offers[0]?.earningsCents).toBeNull();
      expect(result.offers[0]?.earningsLabel).toBe(SUPPORT_CLEANER_EARNINGS_LABEL);
    }
  });

  it("TEAM_OFFERS_ENABLED=false preserves legacy lead-only job list", async () => {
    isTeamOffersEnabledMock.mockReturnValue(false);
    const fromMock = vi.fn((table: string) => {
      if (table === "bookings") {
        return chainable([
          {
            id: "job-lead",
            status: "assigned",
            scheduled_start: "2026-05-20T08:00:00.000Z",
            scheduled_end: "2026-05-20T10:00:00.000Z",
            price_cents: 50_000,
            currency: "ZAR",
            metadata: wizardMetadata(),
            updated_at: "2026-05-16T10:00:00.000Z",
            cleaner_id: "cleaner-lead",
          },
        ]);
      }
      return chainable([]);
    });
    createSupabaseServerClientMock.mockResolvedValue({ from: fromMock });

    const { listCleanerJobs } = await import("./cleanerJobReadModel");
    await listCleanerJobs(cleanerUser);
    expect(fromMock).not.toHaveBeenCalledWith("booking_cleaners");
  });
});
