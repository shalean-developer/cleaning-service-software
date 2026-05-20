import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sign-in page signup link gating", () => {
  const pageSource = readFileSync(resolve(process.cwd(), "src/app/sign-in/page.tsx"), "utf8");
  const contentSource = readFileSync(
    resolve(process.cwd(), "src/app/sign-in/SignInPageContent.tsx"),
    "utf8",
  );

  it("only links to sign-up when the feature flag is enabled on the page", () => {
    expect(pageSource).toContain("isCustomerSignupEnabled");
    expect(pageSource).toContain("signupEnabled");
    expect(contentSource).toMatch(/signupEnabled \?/);
    expect(pageSource).not.toMatch(/href=\{SIGN_UP_PATH\}[\s\S]*SignInPageContent/);
    expect(pageSource).toContain("SignInPageContent");
  });

  it("does not expose E2E testing documentation in customer-facing UI", () => {
    expect(pageSource).not.toContain("live-e2e-smoke-test");
    expect(pageSource).not.toContain("E2E test accounts");
    expect(contentSource).not.toContain("live-e2e-smoke-test");
    expect(contentSource).not.toContain("E2E test accounts");
  });

  it("uses simple centered sign-in layout copy", () => {
    expect(contentSource).toContain("Sign in");
    expect(contentSource).toContain(
      "Sign in to manage your bookings, payments, and cleaner assignments.",
    );
    expect(contentSource).toContain("Create one");
    expect(contentSource).toContain("Reset your password");
    expect(contentSource).not.toContain("UI_AUTH_CARD_CLASS");
    expect(contentSource).not.toContain("SignInBrandMark");
  });
});

describe("SignInForm server action", () => {
  it("submits via signInAction instead of client-side Supabase auth", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/sign-in/SignInForm.tsx"),
      "utf8",
    );
    expect(source).toContain("signInAction");
    expect(source).toContain('action={formAction}');
    expect(source).not.toContain("signInWithPassword");
    expect(source).not.toContain("createSupabaseBrowserClient");
  });

  it("accepts email or mobile number in the identifier field", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/sign-in/SignInForm.tsx"),
      "utf8",
    );
    expect(source).toContain("Email or mobile number");
    expect(source).toContain('type="text"');
    expect(source).toContain('autoComplete="username"');
    expect(source).not.toContain('type="email"');
  });

  it("shows a forgot-password affordance on the password field", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/sign-in/SignInForm.tsx"),
      "utf8",
    );
    expect(source).toContain("Forgot password?");
    expect(source).toContain("onForgotPassword");
  });

  it("uses polished auth input tokens without client-side Supabase auth", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/sign-in/SignInForm.tsx"),
      "utf8",
    );
    expect(source).toContain("UI_AUTH_INPUT_CLASS");
    expect(source).toContain('name="password"');
    expect(source).toContain('type="password"');
    expect(source).not.toContain("signInWithPassword");
  });
});

describe("signInAction", () => {
  it("uses server client and profile lookup before redirect", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/auth/signInAction.ts"),
      "utf8",
    );
    expect(source).toContain('"use server"');
    expect(source).toContain("createSupabaseServerClient");
    expect(source).toContain("signInWithPassword");
    expect(source).toContain("loadProfileRoleForUser");
    expect(source).toContain("redirect(resolvePostSignInPath");
  });

  it("resolves phone identifiers to shalean auth email before sign-in", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/auth/signInAction.ts"),
      "utf8",
    );
    expect(source).toContain("resolveSignInEmail");
    expect(source).toContain("resolvedEmail.email");
  });
});

describe("requestPasswordResetAction", () => {
  it("uses Supabase resetPasswordForEmail with redirect to reset-password", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/auth/requestPasswordResetAction.ts"),
      "utf8",
    );
    expect(source).toContain('"use server"');
    expect(source).toContain("resetPasswordForEmail");
    expect(source).toContain("buildPasswordResetRedirectUrl");
    expect(source).toContain("PASSWORD_RESET_REQUEST_SUCCESS_MESSAGE");
    expect(source).not.toContain("signInWithPassword");
  });
});

describe("updatePasswordAction", () => {
  it("updates password then redirects to sign-in", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/auth/updatePasswordAction.ts"),
      "utf8",
    );
    expect(source).toContain("updateUser");
    expect(source).toContain("passwordReset=success");
    expect(source).toContain("signOut");
  });
});
