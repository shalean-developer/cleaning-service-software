import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isCustomerSignupEnabled } from "@/lib/auth/customerSignupFlag";

const pageSource = readFileSync(resolve(process.cwd(), "src/app/sign-up/page.tsx"), "utf8");
const signInPageSource = readFileSync(resolve(process.cwd(), "src/app/sign-in/page.tsx"), "utf8");
const checkEmailSource = readFileSync(
  resolve(process.cwd(), "src/app/sign-up/check-email/page.tsx"),
  "utf8",
);

describe("Sign-up page feature flag", () => {
  const prev = process.env.ENABLE_CUSTOMER_SIGNUP;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.ENABLE_CUSTOMER_SIGNUP;
    } else {
      process.env.ENABLE_CUSTOMER_SIGNUP = prev;
    }
  });

  it("gates the signup page on isCustomerSignupEnabled", () => {
    expect(pageSource).toContain("isCustomerSignupEnabled");
    expect(pageSource).toContain("SignUpUnavailable");
    expect(pageSource).toContain("SignUpForm");
  });

  it("shows unavailable state instead of the form when flag is disabled", () => {
    delete process.env.ENABLE_CUSTOMER_SIGNUP;
    expect(isCustomerSignupEnabled()).toBe(false);
    expect(pageSource).toMatch(/if\s*\(\s*!isCustomerSignupEnabled\(\)\s*\)/);
    expect(pageSource).toContain("return <SignUpUnavailable />");
  });

  it("renders signup form only on the enabled branch", () => {
    expect(pageSource).toMatch(/if\s*\(\s*!isCustomerSignupEnabled\(\)\s*\)[\s\S]*SignUpUnavailable/);
    expect(pageSource).toContain("<SignUpForm />");
  });

  it("hides signup link on sign-in when flag is disabled", () => {
    delete process.env.ENABLE_CUSTOMER_SIGNUP;
    expect(isCustomerSignupEnabled()).toBe(false);
    expect(signInPageSource).toContain("signupEnabled");
    expect(signInPageSource).toMatch(/\{signupEnabled \?/);
  });

  it("shows signup link on sign-in only when flag is enabled", () => {
    expect(signInPageSource).toContain('href={SIGN_UP_PATH}');
    expect(signInPageSource).toContain("Create one");
  });

  it("blocks check-email page when flag is disabled", () => {
    expect(checkEmailSource).toContain("isCustomerSignupEnabled");
    expect(checkEmailSource).toContain("redirect(SIGN_IN_PATH)");
  });
});

describe("Sign-up page customer-only scope", () => {
  it("does not expose role selection", () => {
    expect(pageSource).not.toMatch(/role/i);
    expect(pageSource).not.toContain("admin");
    expect(pageSource).not.toContain("cleaner");
  });
});
