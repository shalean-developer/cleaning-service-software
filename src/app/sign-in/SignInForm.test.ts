import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sign-in page signup link gating", () => {
  it("only links to sign-up when the feature flag is enabled on the page", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/app/sign-in/page.tsx"),
      "utf8",
    );
    expect(pageSource).toContain("isCustomerSignupEnabled");
    expect(pageSource).toMatch(/\{signupEnabled \?/);
    expect(pageSource).not.toMatch(/href=\{SIGN_UP_PATH\}[\s\S]*SignInForm/);
  });
});

describe("SignInForm post-sign-in profile lookup", () => {
  it("scopes profile role lookup to the session user via loadProfileRoleForUser", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/sign-in/SignInForm.tsx"),
      "utf8",
    );
    expect(source).toContain("loadProfileRoleForUser");
    expect(source).toContain("auth.getUser()");
    expect(source).not.toMatch(/\.from\("profiles"\)/);
  });
});
