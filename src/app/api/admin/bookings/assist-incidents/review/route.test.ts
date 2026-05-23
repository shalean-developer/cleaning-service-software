import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

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

vi.mock("@/features/bookings/server/admin/loadAdminAssistedProductionStatus", () => ({
  loadAdminAssistedProductionStatus: vi.fn(),
}));

vi.mock("@/features/bookings/server/admin/adminAssistedIncidentReviewRepository", () => ({
  upsertAdminAssistedIncidentReview: vi.fn(),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: vi.fn(() => ({})),
}));

describe("POST /api/admin/bookings/assist-incidents/review", () => {
  it("returns 401 for non-admin", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      ok: false,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
      status: 401,
    });

    const response = await POST(
      new Request("http://localhost/api/admin/bookings/assist-incidents/review", {
        method: "POST",
        body: JSON.stringify({ incidentKey: "x", status: "open" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("upserts review for known incident", async () => {
    const { requireApiUser } = await import("@/features/dashboards/server/apiAuth");
    const { loadAdminAssistedProductionStatus } = await import(
      "@/features/bookings/server/admin/loadAdminAssistedProductionStatus"
    );
    const { upsertAdminAssistedIncidentReview } = await import(
      "@/features/bookings/server/admin/adminAssistedIncidentReviewRepository"
    );

    vi.mocked(requireApiUser).mockResolvedValueOnce({
      id: "admin-1",
      role: "admin",
      email: "admin@example.com",
      profileId: "profile-1",
    });

    vi.mocked(loadAdminAssistedProductionStatus).mockResolvedValueOnce({
      activeIncidents: [
        {
          id: "link_regeneration_loop:b1",
          bookingId: "b1",
          customerLabel: "Jane",
          category: "link_regeneration_loop",
          severity: "warning",
          title: "Loop",
          guidance: "Review",
          escalation: "Ops",
          occurrenceCount: 2,
        },
      ],
    } as never);

    vi.mocked(upsertAdminAssistedIncidentReview).mockResolvedValueOnce({
      id: "review-1",
      incidentKey: "link_regeneration_loop:b1",
      bookingId: "b1",
      category: "link_regeneration_loop",
      status: "resolved",
      severity: "warning",
      ownerProfileId: "profile-1",
      rootCauseNotes: "Done",
      resolutionNotes: "Fixed",
      followUpAction: null,
      reviewedAt: "2026-05-23T10:00:00.000Z",
      reviewedBy: "profile-1",
      createdAt: "2026-05-23T09:00:00.000Z",
      updatedAt: "2026-05-23T10:00:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/admin/bookings/assist-incidents/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentKey: "link_regeneration_loop:b1",
          status: "resolved",
          rootCauseNotes: "Done",
          resolutionNotes: "Fixed",
        }),
      }),
    );

    const json = (await response.json()) as { ok: boolean };
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(upsertAdminAssistedIncidentReview).toHaveBeenCalledOnce();
  });
});
