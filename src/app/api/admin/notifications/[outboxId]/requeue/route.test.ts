import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const requireApiUserMock = vi.fn();
const requeueMock = vi.fn();

vi.mock("@/features/dashboards/server/apiAuth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
  isApiAuthFailure: (user: unknown) =>
    typeof user === "object" && user !== null && "ok" in user && (user as { ok: boolean }).ok === false,
}));

vi.mock("@/features/notifications/server/adminRequeueNotificationOutbox", () => ({
  adminRequeueNotificationOutbox: (...args: unknown[]) => requeueMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

describe("POST /api/admin/notifications/[outboxId]/requeue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue(adminUser);
  });

  it("rejects unauthenticated requests", async () => {
    requireApiUserMock.mockResolvedValue({
      ok: false,
      status: 401,
      error: "UNAUTHORIZED",
      message: "Sign in required.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ reason: "valid reason here" }),
      }),
      { params: Promise.resolve({ outboxId: "outbox-1" }) },
    );
    expect(response.status).toBe(401);
  });

  it("returns requeued outcome for admin", async () => {
    requeueMock.mockResolvedValue({
      ok: true,
      outcome: "requeued",
      outboxId: "outbox-1",
      bookingId: "booking-1",
      template: "payment_failed",
      status: "pending",
      deliveryDedupeWouldBlock: false,
      message: "Notification requeued to pending.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Provider fixed" }),
      }),
      { params: Promise.resolve({ outboxId: "outbox-1" }) },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.outcome).toBe("requeued");
    expect(requeueMock).toHaveBeenCalledWith(
      adminUser,
      "outbox-1",
      expect.objectContaining({ reason: "Provider fixed" }),
    );
  });
});
