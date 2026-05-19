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
