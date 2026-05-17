import { describe, expect, it, vi } from "vitest";
import {
  recordAdminOperationalAudit,
  sanitizeAdminOperationalMetadata,
} from "./recordAdminOperationalAudit";

describe("sanitizeAdminOperationalMetadata", () => {
  it("keeps allowlisted primitives and drops secrets", () => {
    const result = sanitizeAdminOperationalMetadata({
      engine_outcome: "offered",
      eligible: true,
      authorization: "Bearer secret",
      token: "abc",
      password: "x",
      raw: { nested: true },
      unknown_key: "drop me",
    });
    expect(result).toEqual({
      engine_outcome: "offered",
      eligible: true,
    });
  });
});

describe("recordAdminOperationalAudit", () => {
  it("inserts via service client and does not throw on success", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as Parameters<typeof recordAdminOperationalAudit>[0];

    await recordAdminOperationalAudit(client, {
      bookingId: "booking-1",
      adminProfileId: "admin-1",
      action: "assignment_recovery",
      outcome: "success",
      reason: "Customer called support",
      idempotencyKey: "admin:recovery:booking-1",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_id: "booking-1",
        action: "assignment_recovery",
        outcome: "success",
        idempotency_key: "admin:recovery:booking-1",
      }),
    );
  });

  it("omits idempotency key for rejected outcomes", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as Parameters<typeof recordAdminOperationalAudit>[0];

    await recordAdminOperationalAudit(client, {
      bookingId: "booking-1",
      adminProfileId: "admin-1",
      action: "manual_dispatch_offer",
      outcome: "rejected",
      reason: "Not eligible for dispatch",
      idempotencyKey: "admin:dispatch:booking-1:cleaner-1",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotency_key: null,
      }),
    );
  });

  it("logs warning and does not throw when insert fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const insert = vi.fn().mockResolvedValue({ error: { code: "XX", message: "fail" } });
    const client = {
      from: vi.fn(() => ({ insert })),
    } as unknown as Parameters<typeof recordAdminOperationalAudit>[0];

    await expect(
      recordAdminOperationalAudit(client, {
        bookingId: "booking-1",
        adminProfileId: "admin-1",
        action: "replace_open_offer",
        outcome: "failed",
        reason: "Replace failed unexpectedly",
      }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("no-ops when client is null", async () => {
    await expect(
      recordAdminOperationalAudit(null, {
        bookingId: "booking-1",
        adminProfileId: "admin-1",
        action: "assignment_recovery",
        outcome: "success",
      }),
    ).resolves.toBeUndefined();
  });
});
