import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "./types";

const getCurrentUserMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();
const resolveActorScopeMock = vi.fn();
const redirectMock = vi.fn();

vi.mock("./getCurrentUser", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: (...args: unknown[]) => resolveActorScopeMock(...args),
}));

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

const customerUser: CurrentUser = {
  profileId: "profile-customer",
  role: "customer",
  authUser: { id: "profile-customer", email: "c@test.com" } as CurrentUser["authUser"],
};

const adminUser: CurrentUser = {
  profileId: "profile-admin",
  role: "admin",
  authUser: { id: "profile-admin", email: "a@test.com" } as CurrentUser["authUser"],
};

describe("checkCustomerReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClientMock.mockResolvedValue({});
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: "cust-1" });
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("returns unauthenticated when there is no session", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const { checkCustomerReadiness } = await import("./customerReadiness");
    const result = await checkCustomerReadiness();
    expect(result.status).toBe("unauthenticated");
  });

  it("returns wrong_role for non-customer profiles", async () => {
    getCurrentUserMock.mockResolvedValue(adminUser);
    const { checkCustomerReadiness } = await import("./customerReadiness");
    const result = await checkCustomerReadiness();
    expect(result).toEqual({ status: "wrong_role", user: adminUser });
  });

  it("returns provisioning_incomplete when customers row is missing", async () => {
    getCurrentUserMock.mockResolvedValue(customerUser);
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: null });
    const { checkCustomerReadiness } = await import("./customerReadiness");
    const result = await checkCustomerReadiness();
    expect(result).toEqual({ status: "provisioning_incomplete", user: customerUser });
  });

  it("returns ready with actingCustomerId when provisioned", async () => {
    getCurrentUserMock.mockResolvedValue(customerUser);
    const { checkCustomerReadiness } = await import("./customerReadiness");
    const result = await checkCustomerReadiness();
    expect(result).toEqual({
      status: "ready",
      user: customerUser,
      actingCustomerId: "cust-1",
    });
  });
});

describe("customerProvisioningApiFailure", () => {
  it("uses PROVISIONING_INCOMPLETE with 403", async () => {
    const { customerProvisioningApiFailure, PROVISIONING_INCOMPLETE_CODE } =
      await import("./customerReadiness");
    expect(customerProvisioningApiFailure()).toEqual({
      ok: false,
      code: PROVISIONING_INCOMPLETE_CODE,
      message: "Account setup is not complete. Finish setup before continuing.",
      status: 403,
    });
  });
});

describe("requireCustomerReadyForPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createSupabaseServerClientMock.mockResolvedValue({});
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects orphan customers to setup with redirectedFrom", async () => {
    getCurrentUserMock.mockResolvedValue(customerUser);
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: null });
    const { requireCustomerReadyForPath } = await import("./requireCustomerReady");

    await expect(requireCustomerReadyForPath("/customer/book")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(
      "/customer/setup?redirectedFrom=%2Fcustomer%2Fbook",
    );
  });

  it("does not redirect when customer is ready", async () => {
    getCurrentUserMock.mockResolvedValue(customerUser);
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: "cust-1" });
    const { requireCustomerReadyForPath } = await import("./requireCustomerReady");

    await expect(requireCustomerReadyForPath("/customer/book")).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
