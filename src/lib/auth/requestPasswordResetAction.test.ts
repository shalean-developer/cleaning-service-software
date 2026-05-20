import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordForEmailMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/app/appBaseUrl", () => ({
  getServerAppBaseUrl: () => "http://localhost:3000",
}));

import { requestPasswordResetAction } from "./requestPasswordResetAction";

describe("requestPasswordResetAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordForEmailMock.mockResolvedValue({ error: null });
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { resetPasswordForEmail: resetPasswordForEmailMock },
    });
  });

  it("calls Supabase resetPasswordForEmail with reset-password redirect", async () => {
    const formData = new FormData();
    formData.set("email", "customer@example.com");

    const result = await requestPasswordResetAction(null, formData);

    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("customer@example.com", {
      redirectTo: "http://localhost:3000/reset-password",
    });
    expect(result).toEqual({
      success: true,
      message: "If an account exists for this email, we'll send a reset link shortly.",
    });
  });

  it("returns success for valid email even when Supabase returns an error", async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      error: { message: "User not found" },
    });
    const formData = new FormData();
    formData.set("email", "unknown@example.com");

    const result = await requestPasswordResetAction(null, formData);

    expect(result).toEqual({
      success: true,
      message: "If an account exists for this email, we'll send a reset link shortly.",
    });
  });

  it("rejects invalid email without calling Supabase", async () => {
    const formData = new FormData();
    formData.set("email", "not-an-email");

    const result = await requestPasswordResetAction(null, formData);

    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(result).toEqual({ error: "Enter a valid email address." });
  });
});
