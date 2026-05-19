import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const getCurrentUserMock = vi.fn();
const headersMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

vi.mock("next/headers", () => ({
  headers: () => headersMock(),
}));

vi.mock("./getCurrentUser", () => ({
  getCurrentUser: () => getCurrentUserMock(),
}));

import { requireProfileRole } from "./requireProfileRole";

describe("requireProfileRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers({ "x-pathname": "/admin/payouts" }));
  });

  it("redirects unauthenticated users to sign-in", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(requireProfileRole(["admin"])).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/sign-in?redirectedFrom=%2Fadmin%2Fpayouts");
  });

  it("blocks customer profile from admin routes", async () => {
    getCurrentUserMock.mockResolvedValue({
      profileId: "customer-id",
      role: "customer",
      authUser: { id: "customer-id" },
    });

    await expect(requireProfileRole(["admin"])).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/customer");
  });

  it("allows admin profile on admin routes", async () => {
    getCurrentUserMock.mockResolvedValue({
      profileId: "admin-id",
      role: "admin",
      authUser: { id: "admin-id" },
    });

    await requireProfileRole(["admin"]);

    expect(redirectMock).not.toHaveBeenCalled();
  });
});
