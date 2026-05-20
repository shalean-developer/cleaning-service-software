import { beforeEach, describe, expect, it, vi } from "vitest";

const loadProfileRoleForUserMock = vi.fn();
const resolveSignInEmailMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();

vi.mock("@/lib/auth/loadProfileRole", () => ({
  loadProfileRoleForUser: (...args: unknown[]) => loadProfileRoleForUserMock(...args),
}));

vi.mock("@/lib/auth/cleanerAuthIdentity", () => ({
  resolveSignInEmail: (...args: unknown[]) => resolveSignInEmailMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

import { signInAction } from "./signInAction";

const USER_ID = "168c96e1-3d07-447f-bf64-3c0bbb8f9a3b";

function buildForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("email", overrides.email ?? "admin@test.com");
  form.set("password", overrides.password ?? "secret");
  if (overrides.redirectedFrom) form.set("redirectedFrom", overrides.redirectedFrom);
  return form;
}

describe("signInAction", () => {
  const signInWithPassword = vi.fn();
  const signOut = vi.fn();
  const getUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resolveSignInEmailMock.mockReturnValue({ ok: true, email: "admin@test.com" });
    createSupabaseServerClientMock.mockResolvedValue({
      auth: { signInWithPassword, signOut, getUser },
    });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID }, session: { access_token: "token" } },
      error: null,
    });
    getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  });

  it("returns admin redirect path without server redirect", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "admin" });

    const result = await signInAction(
      null,
      buildForm({ redirectedFrom: "/admin/payouts" }),
    );

    expect(result).toEqual({ redirectTo: "/admin/payouts" });
    expect(signInWithPassword).toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(loadProfileRoleForUserMock).toHaveBeenCalledWith(expect.anything(), USER_ID);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("defaults admin role to /admin when redirectedFrom is outside namespace", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "admin" });

    const result = await signInAction(null, buildForm({ redirectedFrom: "/cleaner/jobs" }));

    expect(result).toEqual({ redirectTo: "/admin" });
  });

  it("signs out and returns error when profile is missing", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({
      ok: false,
      error: "Signed in but no profile was found.",
    });

    const result = await signInAction(null, buildForm());

    expect(signOut).toHaveBeenCalled();
    expect(result).toEqual({ error: "Signed in but no profile was found." });
  });

  it("does not grant admin redirect for customer role", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "customer" });

    const result = await signInAction(
      null,
      buildForm({ redirectedFrom: "/admin/payouts" }),
    );

    expect(result).toEqual({ redirectTo: "/customer" });
  });

  it("loads profile after sign-in without refreshing session when session is present", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "cleaner" });

    const result = await signInAction(null, buildForm());

    expect(result).toEqual({ redirectTo: "/cleaner" });
    const signInOrder = signInWithPassword.mock.invocationCallOrder[0];
    const profileOrder = loadProfileRoleForUserMock.mock.invocationCallOrder[0];
    expect(signInOrder).toBeLessThan(profileOrder);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refreshes session only when sign-in returns no session", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID }, session: null },
      error: null,
    });
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "admin" });

    await signInAction(null, buildForm());

    expect(getUser).toHaveBeenCalled();
  });
});
