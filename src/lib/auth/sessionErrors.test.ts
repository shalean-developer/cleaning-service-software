import type { AuthError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isStaleRefreshTokenError } from "./sessionErrors";

describe("isStaleRefreshTokenError", () => {
  it("matches refresh_token_not_found code", () => {
    expect(
      isStaleRefreshTokenError({
        name: "AuthApiError",
        message: "Invalid Refresh Token: Refresh Token Not Found",
        code: "refresh_token_not_found",
        status: 400,
      } as AuthError),
    ).toBe(true);
  });

  it("matches message when code is absent", () => {
    expect(
      isStaleRefreshTokenError({
        name: "AuthApiError",
        message: "Invalid Refresh Token: Refresh Token Not Found",
        status: 400,
      } as AuthError),
    ).toBe(true);
  });

  it("returns false for other auth errors", () => {
    expect(
      isStaleRefreshTokenError({
        name: "AuthApiError",
        message: "Invalid login credentials",
        status: 400,
      } as AuthError),
    ).toBe(false);
  });

  it("returns false for null", () => {
    expect(isStaleRefreshTokenError(null)).toBe(false);
  });
});
