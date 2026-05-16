import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import {
  CLEANER_API_FORBIDDEN_FINANCIAL_KEYS,
  collectForbiddenCleanerApiKeys,
} from "./cleanerApiPayload";

const getCurrentUserMock = vi.fn();
const requireApiUserMock = vi.fn();
const listCleanerOffersForDashboardMock = vi.fn();
const listCleanerJobsMock = vi.fn();
const getCleanerJobDetailMock = vi.fn();

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (value: unknown) =>
    value != null && typeof value === "object" && "error" in value,
}));

vi.mock("@/features/dashboards/server/cleanerJobReadModel", () => ({
  listCleanerOffersForDashboard: (...args: unknown[]) =>
    listCleanerOffersForDashboardMock(...args),
  listCleanerJobs: (...args: unknown[]) => listCleanerJobsMock(...args),
  getCleanerJobDetail: (...args: unknown[]) => getCleanerJobDetailMock(...args),
}));

const cleanerUser: CurrentUser = {
  profileId: "profile-cleaner",
  role: "cleaner",
  authUser: { id: "auth-cleaner" } as CurrentUser["authUser"],
};

const safeOffer = {
  offerId: "offer-1",
  bookingId: "booking-1",
  status: "offered" as const,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  offeredAt: new Date().toISOString(),
  scheduleLabel: "Mon · 08:00 – 10:00",
  locationSummary: "Sea Point",
  serviceLabel: "Deep Cleaning",
  earningsCents: 25_000,
  earningsLabel: "R250.00",
  isExpired: false,
};

const safeJobDetail = {
  bookingId: "booking-1",
  status: "assigned" as const,
  scheduledStart: "2026-05-20T08:00:00.000Z",
  scheduledEnd: "2026-05-20T10:00:00.000Z",
  scheduleLabel: "Mon · 08:00 – 10:00",
  locationSummary: "Sea Point",
  serviceLabel: "Deep Cleaning",
  earningsCents: 25_000,
  earningsLabel: "R250.00",
  updatedAt: "2026-05-16T10:00:00.000Z",
  timeline: [],
  specialInstructions: null,
  earnings: [],
};

describe("cleaner API financial serialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(cleanerUser);
    getCurrentUserMock.mockResolvedValue(cleanerUser);
  });

  it("GET /api/cleaner/offers does not expose customer financial fields", async () => {
    listCleanerOffersForDashboardMock.mockResolvedValue({
      ok: true,
      offers: [safeOffer],
    });

    const { GET } = await import("@/app/api/cleaner/offers/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(collectForbiddenCleanerApiKeys(body)).toEqual([]);
    for (const key of CLEANER_API_FORBIDDEN_FINANCIAL_KEYS) {
      expect(JSON.stringify(body)).not.toContain(`"${key}"`);
    }
    expect(body.offers[0]).toMatchObject({
      earningsCents: 25_000,
      earningsLabel: "R250.00",
    });
  });

  it("GET /api/cleaner/jobs/[bookingId] does not expose customer financial fields", async () => {
    getCleanerJobDetailMock.mockResolvedValue({
      ok: true,
      job: safeJobDetail,
    });

    const { GET } = await import("@/app/api/cleaner/jobs/[bookingId]/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ bookingId: "booking-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(collectForbiddenCleanerApiKeys(body)).toEqual([]);
    expect(body.job).not.toHaveProperty("priceLabel");
    expect(body.job).not.toHaveProperty("priceCents");
    expect(body.job).toMatchObject({
      earningsLabel: "R250.00",
      earningsCents: 25_000,
    });
  });
});
