import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";

const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("./config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./config")>();
  return {
    ...actual,
    canRunNotificationDelivery: () => true,
    isNotificationDeliveryEnabled: () => true,
    getNotificationDeliveryConfig: () => ({
      enabled: true,
      emailProvider: "dry_run" as const,
      providerReady: true,
      fromEmail: "noreply@test.com",
      supportEmail: null,
      appBaseUrl: "https://app.example.com",
    }),
    getProcessingStaleMinutes: () => 15,
  };
});

const adminUser: CurrentUser = {
  profileId: "admin-profile",
  role: "admin",
  authUser: { id: "auth-admin" } as CurrentUser["authUser"],
};

function chainable(rows: unknown[] | null, count: number | null = null, error: unknown = null) {
  const result = { data: rows, error, count: count ?? rows?.length ?? 0 };
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    not: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: rows?.[0] ?? null, error })),
    then: (
      onFulfilled: (v: typeof result) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

describe("getAdminNotificationHealthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin users", async () => {
    const { getAdminNotificationHealthPage, parseNotificationHealthFilters } = await import(
      "./notificationAdminReadModel"
    );
    const result = await getAdminNotificationHealthPage(
      { ...adminUser, role: "customer" },
      parseNotificationHealthFilters({}),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  it("returns failed deliverable rows in needs-attention list", async () => {
    const failedRow = {
      id: "fail-1",
      channel: "email",
      recipient: "cust-1",
      payload: { template: "payment_failed", bookingId: "booking-1" },
      status: "failed",
      attempts: 5,
      next_retry_at: null,
      last_error: "Customer has no email address.",
      created_at: "2026-05-17T11:00:00.000Z",
      updated_at: "2026-05-17T11:00:00.000Z",
    };

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table !== "notification_outbox") return chainable([], 0);
        return {
          select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) return chainable(null, 0);
            return chainable([failedRow]);
          }),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        };
      }),
    });

    const { getAdminNotificationHealthPage, parseNotificationHealthFilters } = await import(
      "./notificationAdminReadModel"
    );
    const result = await getAdminNotificationHealthPage(
      adminUser,
      parseNotificationHealthFilters({}),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.rows.some((r) => r.status === "failed")).toBe(true);
      const failed = result.page.rows.find((r) => r.id === "fail-1");
      expect(failed?.canRequeue).toBe(true);
      const json = JSON.stringify(result.page.rows);
      expect(json).not.toContain("@");
      expect(json).not.toContain("payload");
    }
  });

  it("unsupported-only filter does not include deliverable failed rows", async () => {
    const rows = [
      {
        id: "u-1",
        channel: "email",
        recipient: "cust-1",
        payload: { template: "payment_pending", bookingId: "booking-1" },
        status: "pending",
        attempts: 0,
        next_retry_at: null,
        last_error: null,
        created_at: "2026-05-17T11:00:00.000Z",
        updated_at: "2026-05-17T11:00:00.000Z",
      },
    ];

    createSupabaseServerClientMock.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) return chainable(null, 1);
          return chainable(rows);
        }),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })),
    });

    const { getAdminNotificationHealthPage, parseNotificationHealthFilters } = await import(
      "./notificationAdminReadModel"
    );
    const result = await getAdminNotificationHealthPage(
      adminUser,
      parseNotificationHealthFilters({ deliverable: "false", status: "pending" }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.page.rows.every((r) => !r.isDeliverable)).toBe(true);
      expect(result.page.rows.every((r) => r.status !== "failed")).toBe(true);
    }
  });
});

describe("parseNotificationHealthFilters", () => {
  it("defaults to needs-attention deliverable statuses", async () => {
    const { parseNotificationHealthFilters } = await import("./notificationAdminReadModel");
    const filters = parseNotificationHealthFilters({});
    expect(filters.deliverable).toBe("true");
    expect(filters.status).toEqual(["pending", "processing", "failed"]);
  });
});
