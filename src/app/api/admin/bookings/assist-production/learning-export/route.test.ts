import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: vi.fn(),
  isApiAuthFailure: vi.fn(
    (result: unknown) =>
      typeof result === "object" &&
      result !== null &&
      "status" in result &&
      (result as { status: number }).status >= 400,
  ),
}));

vi.mock("@/features/bookings/server/admin/loadAdminAssistedProductionLearning", () => ({
  loadAdminAssistedProductionLearning: vi.fn(),
}));

describe("GET /api/admin/bookings/assist-production/learning-export", () => {
  it("returns 401 for non-admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
      status: 401,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/bookings/assist-production/learning-export?export=weekly"),
    );
    expect(response.status).toBe(401);
  });

  it("returns weekly review CSV without secrets", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { loadAdminAssistedProductionLearning } = await import(
      "@/features/bookings/server/admin/loadAdminAssistedProductionLearning"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
      profileId: "profile-1",
    });

    vi.mocked(loadAdminAssistedProductionLearning).mockResolvedValueOnce({
      generatedAt: "2026-05-23T10:00:00.000Z",
      readOnly: true,
      production: {} as never,
      incidentsWithReview: [],
      unresolvedIncidentCount: 0,
      operatorLessons: [],
      weeklyReview: {
        generatedAt: "2026-05-23T10:00:00.000Z",
        periodLabel: "Rolling 7-day operational window",
        healthScore: 88,
        healthBand: "healthy",
        healthScoreTrend: "stable",
        bookingsCreated: 5,
        conversionRate: 0.6,
        paymentSuccessRate: 0.6,
        assignmentSuccessRate: 1,
        recurringSuccessRate: 1,
        failedNotifications: 0,
        unresolvedIncidents: 0,
        operatorFeedbackHighlights: ["Clear flow"],
        recommendedDecision: {
          decision: "continue_pilot",
          label: "Continue",
          rationale: "Stable",
          advisoryOnly: true,
        },
      },
      improvementBacklog: [],
      rolloutDecision: {
        decision: "continue_pilot",
        label: "Continue",
        rationale: "Stable",
        advisoryOnly: true,
      },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/bookings/assist-production/learning-export?export=weekly&format=csv",
      ),
    );
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("health_score");
    expect(text.toLowerCase()).not.toContain("sk_live_");
  });
});
