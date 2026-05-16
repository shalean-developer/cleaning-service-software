import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/sign-up/SignUpForm.tsx"), "utf8");

describe("SignUpForm", () => {
  it("uses Supabase signUp with buildCustomerSignupMetadata only", () => {
    expect(source).toContain("auth.signUp");
    expect(source).toContain("buildCustomerSignupMetadata");
    expect(source).not.toMatch(/role\s*:/);
    expect(source).not.toContain('"role"');
    expect(source).not.toContain("'role'");
  });

  it("does not expose role selection UI", () => {
    expect(source).not.toMatch(/<select[^>]*name=["']role["']/);
    expect(source).not.toMatch(/name=["']role["']/);
    expect(source).not.toContain("admin");
    expect(source).not.toContain("cleaner");
  });

  it("rejects non-customer profiles after signup", () => {
    expect(source).toContain('profileResult.role !== "customer"');
    expect(source).toContain("signOut");
  });

  it("routes to check-email when no session is returned", () => {
    expect(source).toContain("!data.session");
    expect(source).toContain("SIGN_UP_CHECK_EMAIL_PATH");
  });

  it("routes to customer dashboard when session exists", () => {
    expect(source).toContain("resolvePostCustomerSignUpPath");
    expect(source).toContain("loadProfileRoleForUser");
  });

  it("scopes profile lookup to the session user", () => {
    expect(source).toContain("auth.getUser()");
    expect(source).not.toMatch(/\.from\("profiles"\)/);
  });
});
