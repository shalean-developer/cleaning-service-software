import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_PATH,
  CAREERS_PATH,
  CLEANER_LOGIN_ENTRY_PATH,
  CUSTOMER_LOGIN_ENTRY_PATH,
  SIGNUP_ENTRY_PATH,
} from "@/lib/auth/authEntryPaths";

describe("auth role chooser page", () => {
  const source = readFileSync(resolve(process.cwd(), "src/app/auth/page.tsx"), "utf8");

  it("exposes canonical entry paths", () => {
    expect(AUTH_PATH).toBe("/auth");
    expect(CUSTOMER_LOGIN_ENTRY_PATH).toBe("/login?role=customer");
    expect(SIGNUP_ENTRY_PATH).toBe("/signup");
    expect(CLEANER_LOGIN_ENTRY_PATH).toBe("/cleaner/login");
    expect(CAREERS_PATH).toBe("/careers");
  });

  it("renders role-selection copy and actions without auth logic", () => {
    expect(source).toContain("What would you like to do?");
    expect(source).toContain("Sign in as Customer");
    expect(source).toContain("Sign in as Cleaner");
    expect(source).toContain("Need an account?");
    expect(source).toContain("Create one");
    expect(source).toContain("Apply to become a cleaner");
    expect(source).toContain("CUSTOMER_LOGIN_ENTRY_PATH");
    expect(source).toContain("CLEANER_LOGIN_ENTRY_PATH");
    expect(source).toContain("SIGNUP_ENTRY_PATH");
    expect(source).toContain("CAREERS_PATH");
    expect(source).not.toContain("signInAction");
    expect(source).not.toContain("createSupabase");
  });

  it("links policy pages and shows brand footer", () => {
    expect(source).toContain('href="/terms"');
    expect(source).toContain('href="/privacy"');
    expect(source).toContain('href="/refund-policy"');
    expect(source).toContain("© 2026 Shalean Cleaning Services");
    expect(source).toContain("ShaleanLogo");
  });
});

describe("auth entry redirects", () => {
  const configSource = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

  it("maps friendly login paths to canonical sign-in routes", () => {
    expect(configSource).toContain('source: "/login"');
    expect(configSource).toContain('destination: "/sign-in"');
    expect(configSource).toContain('source: "/signup"');
    expect(configSource).toContain('destination: "/sign-up"');
    expect(configSource).toContain('source: "/cleaner/login"');
    expect(configSource).toContain("redirectedFrom=%2Fcleaner%2Foffers");
    expect(configSource).toContain('source: "/careers"');
    expect(configSource).toContain('destination: "/apply"');
  });
});
