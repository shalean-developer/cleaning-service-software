import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { fetchAdminCustomerById } from "./adminCustomerPrefill";

describe("fetchAdminCustomerById", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/api/admin/customers/11111111")) {
          return new Response(
            JSON.stringify({
              ok: true,
              customer: {
                customerId: "11111111-1111-4111-8111-111111111111",
                companyName: "Jane Customer",
                authEmail: "jane@example.com",
                phone: "+27821234567",
                profileFullName: "Jane Doe",
              },
            }),
            { status: 200 },
          );
        }
        if (url.includes("/api/admin/customers/missing")) {
          return new Response(
            JSON.stringify({ ok: false, error: "NOT_FOUND", message: "Customer not found." }),
            { status: 404 },
          );
        }
        return new Response(JSON.stringify({ ok: false, message: "Failed" }), { status: 500 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads real customer profile by id", async () => {
    const result = await fetchAdminCustomerById("11111111-1111-4111-8111-111111111111");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.customer.label).toBe("Jane Customer");
    expect(result.customer.email).toBe("jane@example.com");
  });

  it("returns clear error for missing customer", async () => {
    const result = await fetchAdminCustomerById("missing");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("Customer not found");
  });
});
