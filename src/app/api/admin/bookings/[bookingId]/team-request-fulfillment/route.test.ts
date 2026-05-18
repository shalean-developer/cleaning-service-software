import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const requireApiUserMock = vi.hoisted(() => vi.fn());
const recordMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: requireApiUserMock,
  isApiAuthFailure: (value: unknown) =>
    typeof value === "object" && value !== null && "error" in value,
}));

vi.mock("@/features/dashboards/server/recordAdminTeamRequestFulfillment", () => ({
  recordAdminTeamRequestFulfillment: recordMock,
}));

describe("PATCH team-request-fulfillment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ role: "admin", profileId: "admin-1" });
  });

  it("rejects invalid fulfilledCleanerCount", async () => {
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfilledCleanerCount: 3 }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("records fulfillment for valid payload", async () => {
    recordMock.mockResolvedValue({
      ok: true,
      fulfillment: {
        fulfilledCleanerCount: 2,
        recordedAt: "2026-05-18T10:00:00.000Z",
        recordedByProfileId: "admin-1",
      },
    });

    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fulfilledCleanerCount: 2 }),
      }),
      { params: Promise.resolve({ bookingId: "booking-1" }) },
    );

    expect(response.status).toBe(200);
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "admin-1" }),
      "booking-1",
      2,
    );
  });
});
