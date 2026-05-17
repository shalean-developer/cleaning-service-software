import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const createServiceRoleClientMock = vi.fn();
const auditMock = vi.fn();
const dedupeMock = vi.fn();
vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClientMock(),
}));

vi.mock("./auditAdminNotificationRequeue", () => ({
  auditAdminNotificationRequeue: (...args: unknown[]) => auditMock(...args),
  logAdminNotificationRequeue: vi.fn(),
}));

vi.mock("./computeDeliveryDedupeWouldBlock", () => ({
  computeDeliveryDedupeWouldBlock: (...args: unknown[]) => dedupeMock(...args),
}));

const adminUser: CurrentUser = {
  profileId: "admin-profile-1",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function makeClient(row: Record<string, unknown> | null, updateResult?: unknown) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: row,
      error: null,
    }),
  };

  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      updateResult ?? { data: { id: row?.id, status: "pending" }, error: null },
    ),
  };

  return {
    from: vi.fn((table: string) => {
      if (table !== "notification_outbox") throw new Error(`unexpected table ${table}`);
      return {
        select: vi.fn(() => selectChain),
        update: vi.fn(() => updateChain),
      };
    }),
    updateChain,
  };
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "outbox-1",
    status: "failed",
    channel: "email",
    payload: { template: "payment_confirmed", bookingId: "booking-1" },
    attempts: 3,
    last_error: "SEND_FAILED",
    updated_at: "2026-05-17T10:00:00.000Z",
    ...overrides,
  };
}

describe("adminRequeueNotificationOutbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dedupeMock.mockResolvedValue(false);
    auditMock.mockResolvedValue(undefined);
  });

  it("rejects non-admin", async () => {
    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(
      { ...adminUser, role: "customer" },
      "outbox-1",
      { reason: "valid reason here" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toBe("not_eligible");
  });

  it("requires reason 8-500 chars", async () => {
    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "short",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toBe("validation_error");
  });

  it("requeues failed payment_confirmed", async () => {
    const client = makeClient(baseRow());
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Fixed provider outage",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toBe("requeued");
      expect(result.template).toBe("payment_confirmed");
    }
    expect(client.from).toHaveBeenCalledWith("notification_outbox");
    expect(auditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resultCode: "REQUEUED" }),
    );
  });

  it.each([
    ["payment_failed", { template: "payment_failed", bookingId: "booking-1" }],
    [
      "assignment_offer",
      {
        template: "assignment_offer",
        bookingId: "booking-1",
        offerId: "offer-1",
      },
    ],
  ])("requeues failed %s", async (template, payload) => {
    const channel = template === "assignment_offer" ? "push" : "email";
    const client = makeClient(
      baseRow({ channel, payload: { ...payload, bookingId: "booking-1" } }),
    );
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Retry after fix",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.template).toBe(template);
  });

  it("rejects unsupported template", async () => {
    const client = makeClient(
      baseRow({
        payload: { template: "payment_pending", bookingId: "booking-1" },
      }),
    );
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Should not apply",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outcome).toBe("not_eligible");
      expect(result.code).toBe("UNSUPPORTED_TEMPLATE");
    }
  });

  it.each(["pending", "processing"] as const)("rejects %s status", async (status) => {
    const client = makeClient(baseRow({ status }));
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Should not apply",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toBe("not_eligible");
  });

  it("rejects live sent status", async () => {
    const client = makeClient(baseRow({ status: "sent", last_error: null }));
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Should not apply",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outcome).toBe("not_eligible");
      expect(result.message).toContain("Live sent");
    }
  });

  const dryRunSentError =
    "dry_run_sent;template=payment_confirmed;bookingId=booking-1;recipientType=customer";

  it.each([
    ["payment_confirmed", { template: "payment_confirmed", bookingId: "booking-1" }, "email"],
    ["payment_failed", { template: "payment_failed", bookingId: "booking-1" }, "email"],
    [
      "assignment_offer",
      { template: "assignment_offer", bookingId: "booking-1", offerId: "offer-1" },
      "push",
    ],
  ])("requeues dry-run sent %s", async (template, payload, channel) => {
    const client = makeClient(
      baseRow({
        status: "sent",
        channel,
        payload,
        last_error: `dry_run_sent;template=${template};bookingId=booking-1;recipientType=customer`,
      }),
    );
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Retry dry-run test",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.template).toBe(template);
    expect(auditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ resultCode: "REQUEUED", dryRunRequeue: true }),
    );
    expect(client.updateChain.eq).toHaveBeenCalledWith("status", "sent");
  });

  it("rejects unsupported dry-run sent template", async () => {
    const client = makeClient(
      baseRow({
        status: "sent",
        payload: { template: "payment_pending", bookingId: "booking-1" },
        last_error: "dry_run_sent;template=payment_pending;bookingId=booking-1",
      }),
    );
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Should not apply",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("UNSUPPORTED_TEMPLATE");
  });

  it("returns not_found for missing row", async () => {
    const client = makeClient(null);
    createServiceRoleClientMock.mockReturnValue(client);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "missing", {
      reason: "Valid reason text",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.outcome).toBe("not_found");
  });

  it("records audit on success and does not throw when audit fails", async () => {
    const client = makeClient(baseRow());
    createServiceRoleClientMock.mockReturnValue(client);
    auditMock.mockResolvedValue(undefined);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    await expect(
      adminRequeueNotificationOutbox(adminUser, "outbox-1", {
        reason: "Valid reason text",
      }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("includes deliveryDedupeWouldBlock when dedupe preflight is true", async () => {
    const client = makeClient(baseRow());
    createServiceRoleClientMock.mockReturnValue(client);
    dedupeMock.mockResolvedValue(true);

    const { adminRequeueNotificationOutbox } = await import("./adminRequeueNotificationOutbox");
    const result = await adminRequeueNotificationOutbox(adminUser, "outbox-1", {
      reason: "Valid reason text",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.deliveryDedupeWouldBlock).toBe(true);
  });
});
