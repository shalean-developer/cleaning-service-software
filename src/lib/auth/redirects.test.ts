import { describe, expect, it } from "vitest";
import {
  buildCustomerSetupRedirectPath,
  buildSignInRedirectPath,
  CUSTOMER_SETUP_PATH,
  homePathForRole,
  isDashboardPathAllowedForRole,
  requiredRoleForDashboardPath,
  resolvePostSignInPath,
  SIGN_IN_PATH,
} from "./redirects";

describe("buildCustomerSetupRedirectPath", () => {
  it("returns bare setup path when no redirect target", () => {
    expect(buildCustomerSetupRedirectPath()).toBe(CUSTOMER_SETUP_PATH);
    expect(buildCustomerSetupRedirectPath(null)).toBe(CUSTOMER_SETUP_PATH);
  });

  it("includes redirectedFrom for allowed customer paths", () => {
    expect(buildCustomerSetupRedirectPath("/customer/book")).toBe(
      "/customer/setup?redirectedFrom=%2Fcustomer%2Fbook",
    );
    expect(buildCustomerSetupRedirectPath("/customer/book/regular-cleaning")).toBe(
      "/customer/setup?redirectedFrom=%2Fcustomer%2Fbook%2Fregular-cleaning",
    );
  });

  it("ignores setup path and foreign role namespaces", () => {
    expect(buildCustomerSetupRedirectPath("/customer/setup")).toBe(CUSTOMER_SETUP_PATH);
    expect(buildCustomerSetupRedirectPath("/admin")).toBe(CUSTOMER_SETUP_PATH);
  });
});

describe("buildSignInRedirectPath", () => {
  it("returns bare sign-in path when no redirect target", () => {
    expect(buildSignInRedirectPath()).toBe(SIGN_IN_PATH);
    expect(buildSignInRedirectPath(null)).toBe(SIGN_IN_PATH);
  });

  it("includes redirectedFrom for dashboard paths", () => {
    expect(buildSignInRedirectPath("/customer/book")).toBe(
      "/sign-in?redirectedFrom=%2Fcustomer%2Fbook",
    );
  });

  it("ignores unsafe or sign-in redirect targets", () => {
    expect(buildSignInRedirectPath("//evil.com")).toBe(SIGN_IN_PATH);
    expect(buildSignInRedirectPath("/sign-in")).toBe(SIGN_IN_PATH);
  });
});

describe("resolvePostSignInPath", () => {
  it("sends each role to its home dashboard by default", () => {
    expect(resolvePostSignInPath("customer", null)).toBe("/customer");
    expect(resolvePostSignInPath("cleaner", undefined)).toBe("/cleaner");
    expect(resolvePostSignInPath("admin", "")).toBe("/admin");
  });

  it("honours redirectedFrom when allowed for role", () => {
    expect(resolvePostSignInPath("customer", "/customer/book")).toBe("/customer/book");
    expect(resolvePostSignInPath("customer", "/customer/book/regular-cleaning")).toBe(
      "/customer/book/regular-cleaning",
    );
    expect(resolvePostSignInPath("cleaner", "/cleaner/offers")).toBe("/cleaner/offers");
    expect(resolvePostSignInPath("admin", "/admin/payouts")).toBe("/admin/payouts");
  });

  it("ignores redirectedFrom outside role namespace", () => {
    expect(resolvePostSignInPath("customer", "/admin/payouts")).toBe("/customer");
    expect(resolvePostSignInPath("cleaner", "/customer/book")).toBe("/cleaner");
    expect(resolvePostSignInPath("admin", "/cleaner/jobs")).toBe("/admin");
  });
});

describe("isDashboardPathAllowedForRole", () => {
  it("allows role-prefixed paths only", () => {
    expect(isDashboardPathAllowedForRole("/customer/book", "customer")).toBe(true);
    expect(isDashboardPathAllowedForRole("/customer/book/regular-cleaning", "customer")).toBe(
      true,
    );
    expect(isDashboardPathAllowedForRole("/admin", "admin")).toBe(true);
    expect(isDashboardPathAllowedForRole("/cleaner/offers", "cleaner")).toBe(true);
    expect(isDashboardPathAllowedForRole("/admin", "customer")).toBe(false);
  });
});

describe("homePathForRole", () => {
  it("redirects unknown roles to sign-in", () => {
    expect(homePathForRole(null)).toBe(SIGN_IN_PATH);
    expect(homePathForRole(undefined)).toBe(SIGN_IN_PATH);
  });

  it("maps roles to dashboard homes (role mismatch safe redirect)", () => {
    expect(homePathForRole("customer")).toBe("/customer");
    expect(homePathForRole("cleaner")).toBe("/cleaner");
    expect(homePathForRole("admin")).toBe("/admin");
  });
});

describe("requiredRoleForDashboardPath", () => {
  it("identifies protected dashboard prefixes", () => {
    expect(requiredRoleForDashboardPath("/customer/book")).toBe("customer");
    expect(requiredRoleForDashboardPath("/cleaner/offers")).toBe("cleaner");
    expect(requiredRoleForDashboardPath("/admin/payouts")).toBe("admin");
    expect(requiredRoleForDashboardPath("/sign-in")).toBe(null);
  });
});

describe("middleware-style unauthenticated redirect", () => {
  it("builds sign-in URL for protected paths", () => {
    const paths = [
      "/customer",
      "/customer/book",
      "/cleaner/offers",
      "/admin/payouts",
    ];
    for (const path of paths) {
      const url = buildSignInRedirectPath(path);
      expect(url).toContain(SIGN_IN_PATH);
      expect(url).toContain(encodeURIComponent(path));
    }
  });
});
