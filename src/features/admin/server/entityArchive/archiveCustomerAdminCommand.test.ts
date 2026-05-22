import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { archiveCustomerAdminCommand } from "./archiveCustomerAdminCommand";

const mockFrom = vi.fn();

function createMockClient(): SupabaseClient<Database> {
  return { from: mockFrom } as unknown as SupabaseClient<Database>;
}

function chain(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
}

vi.mock("./recordAdminDeleteAudit", () => ({
  recordAdminDeleteAudit: vi.fn(async () => "audit-1"),
  findAdminDeleteAuditByIdempotencyKey: vi.fn(async () => null),
}));

describe("archiveCustomerAdminCommand", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks hard delete when customer has bookings", async () => {
    const customerChain = chain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "cust-1", deleted_at: null },
        error: null,
      }),
    });
    const bookingsCount = chain({
      eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") return customerChain;
      if (table === "bookings") return bookingsCount;
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-1" }, error: null }),
            }),
          }),
        });
      }
      return chain();
    });

    const result = await archiveCustomerAdminCommand(
      {
        customerId: "cust-1",
        adminProfileId: "admin-1",
        reason: "remove duplicate",
        action: "delete",
      },
      createMockClient(),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CUSTOMER_HISTORY_BLOCK");
    }
  });

  it("archives customer with booking history", async () => {
    const customerChain = chain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "cust-2", deleted_at: null },
        error: null,
      }),
    });
    const bookingsSelect = chain({
      eq: vi.fn().mockResolvedValue({ data: [{ id: "b-1" }], error: null }),
    });
    const customerUpdate = chain({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let customerCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") {
        customerCalls += 1;
        return customerCalls === 1 ? customerChain : customerUpdate;
      }
      if (table === "bookings") {
        const c = chain();
        c.eq = vi.fn().mockImplementation(() => {
          return {
            ...c,
            select: vi.fn().mockResolvedValue({ data: [{ id: "b-1" }], error: null }),
            eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
          };
        });
        return bookingsSelect;
      }
      if (table === "payments") {
        const c = chain();
        c.in = vi.fn().mockReturnValue({
          ...c,
          eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
        });
        return c;
      }
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-2" }, error: null }),
            }),
          }),
        });
      }
      return chain();
    });

    const result = await archiveCustomerAdminCommand(
      {
        customerId: "cust-2",
        adminProfileId: "admin-1",
        reason: "spam test account",
        action: "archive",
      },
      createMockClient(),
    );

    expect(result.ok).toBe(true);
  });

  it("permanently deletes customer with no booking history", async () => {
    const customerChain = chain({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "cust-3", deleted_at: null, profile_id: "profile-3" },
        error: null,
      }),
    });
    const zeroBookings = chain({
      eq: vi.fn().mockResolvedValue({ count: 0, error: null, data: [] }),
    });
    const customerDelete = chain();
    customerDelete.delete = vi.fn().mockReturnValue(customerDelete);
    customerDelete.eq = vi.fn().mockResolvedValue({ error: null });

    let customerCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "customers") {
        customerCalls += 1;
        if (customerCalls === 1) return customerChain;
        return customerDelete;
      }
      if (table === "bookings") return zeroBookings;
      if (table === "admin_delete_audit") {
        return chain({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "audit-3" }, error: null }),
            }),
          }),
        });
      }
      return chain();
    });

    const result = await archiveCustomerAdminCommand(
      {
        customerId: "cust-3",
        adminProfileId: "admin-1",
        reason: "remove test signup",
        action: "delete",
      },
      createMockClient(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message).toContain("permanently deleted");
    }
  });
});
