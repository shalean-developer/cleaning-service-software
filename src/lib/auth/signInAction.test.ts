import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn();
const loadProfileRoleForUserMock = vi.fn();
const resolveSignInEmailMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    redirectMock(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

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
      data: { user: { id: USER_ID } },
      error: null,
    });
    getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  });

  it("redirects when auth user has a profile role", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "admin" });

    await expect(
      signInAction(null, buildForm({ redirectedFrom: "/admin/payouts" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(signInWithPassword).toHaveBeenCalled();
    expect(getUser).toHaveBeenCalled();
    expect(loadProfileRoleForUserMock).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
    );
    expect(redirectMock).toHaveBeenCalledWith("/admin/payouts");
    expect(signOut).not.toHaveBeenCalled();
  });

  it("signs out and returns error when profile is missing", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({
      ok: false,
      error: "Signed in but no profile was found.",
    });

    const result = await signInAction(null, buildForm());

    expect(signOut).toHaveBeenCalled();
    expect(result).toEqual({ error: "Signed in but no profile was found." });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("does not grant admin redirect for customer role", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "customer" });

    await expect(
      signInAction(null, buildForm({ redirectedFrom: "/admin/payouts" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith("/customer");
  });

  it("refreshes session before profile lookup", async () => {
    loadProfileRoleForUserMock.mockResolvedValue({ ok: true, role: "cleaner" });

    await expect(signInAction(null, buildForm())).rejects.toThrow("NEXT_REDIRECT");

    const signInOrder = signInWithPassword.mock.invocationCallOrder[0];
    const getUserOrder = getUser.mock.invocationCallOrder[0];
    const profileOrder = loadProfileRoleForUserMock.mock.invocationCallOrder[0];
    expect(signInOrder).toBeLessThan(getUserOrder);
    expect(getUserOrder).toBeLessThan(profileOrder);
  });
});
