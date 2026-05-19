import { describe, expect, it, vi } from "vitest";

const requireApiUser = vi.fn();
const loadCronHealthReadModel = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUser(...args),
  isApiAuthFailure: (result: unknown) =>
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    !("id" in result),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/features/operations/server/cronHealthReadModel", () => ({
  loadCronHealthReadModel: (...args: unknown[]) => loadCronHealthReadModel(...args),
}));

describe("GET /api/admin/cron-health", () => {
  it("returns 401 for non-admin", async () => {
    requireApiUser.mockResolvedValueOnce({
      error: "UNAUTHORIZED",
      message: "Admin required.",
      status: 401,
    });

    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns safe cron health payload without secrets", async () => {
    requireApiUser.mockResolvedValueOnce({ id: "admin-1", role: "admin" });
    loadCronHealthReadModel.mockResolvedValueOnce({
      generatedAt: "2030-06-01T12:00:00.000Z",
      cronSecretConfigured: true,
      jobs: [
        {
          id: "expire-pending-payments",
          name: "Expire pending payments",
          routePath: "/api/cron/expire-pending-payments",
          scheduleSource: "ops_configured",
          scheduleHint: "Hourly",
          expectedFrequencyMinutes: 60,
          docPath: "docs/operations/expire-pending-payments-cron.md",
          launchRequired: true,
          enabled: true,
          status: "healthy",
          statusMessage: "No backlog detected.",
          lastSuccessfulRunAt: null,
          lastFailureRunAt: null,
          recentFailureCount24h: null,
          backlogCount: 0,
          backlogLabel: "Stale pending payments",
          hasRunTelemetry: false,
        },
      ],
    });

    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.cronSecretConfigured).toBe(true);
    expect(body.jobs).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(/CRON_SECRET|Bearer|vault/i);
  });
});
