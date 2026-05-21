import { describe, expect, it } from "vitest";
import { isSupabaseAuthCookieName } from "./supabaseAuthCookie";

describe("isSupabaseAuthCookieName", () => {
  it("matches primary and chunked auth cookies", () => {
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token.0")).toBe(true);
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token.1")).toBe(true);
  });

  it("rejects unrelated cookies", () => {
    expect(isSupabaseAuthCookieName("sb-abcdef-auth-token-code-verifier")).toBe(false);
    expect(isSupabaseAuthCookieName("session")).toBe(false);
  });
});
