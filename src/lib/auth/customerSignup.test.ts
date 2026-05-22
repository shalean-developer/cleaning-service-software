import { describe, expect, it } from "vitest";
import {
  buildCustomerSignupEmailRedirectUrl,
  buildCustomerSignupMetadata,
  resolvePostCustomerSignUpPath,
} from "./customerSignup";

describe("buildCustomerSignupMetadata", () => {
  it("includes normalized full_name and phone", () => {
    expect(buildCustomerSignupMetadata("  Jane Doe  ", "+27821234567")).toEqual({
      full_name: "Jane Doe",
      phone: "+27821234567",
    });
  });

  it("does not accept or emit role", () => {
    const metadata = buildCustomerSignupMetadata("Test User", "+27821234567");
    expect(metadata).not.toHaveProperty("role");
    expect(Object.keys(metadata).sort()).toEqual(["full_name", "phone"]);
  });

  it("cannot be used to inject role via object spread from user input", () => {
    const malicious = { full_name: "Evil", role: "admin" } as { full_name: string; role: string };
    const metadata = buildCustomerSignupMetadata(malicious.full_name, "+27821234567");
    expect(metadata).toEqual({ full_name: "Evil", phone: "+27821234567" });
    expect(metadata).not.toHaveProperty("role");
  });
});

describe("buildCustomerSignupEmailRedirectUrl", () => {
  it("includes redirectedFrom on auth callback when provided", () => {
    const url = new URL(
      buildCustomerSignupEmailRedirectUrl("https://shalean.example", "/customer/book/deep-cleaning"),
    );
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("redirectedFrom")).toBe("/customer/book/deep-cleaning");
  });

  it("omits redirectedFrom when not provided", () => {
    const url = new URL(buildCustomerSignupEmailRedirectUrl("https://shalean.example"));
    expect(url.searchParams.has("redirectedFrom")).toBe(false);
  });
});

describe("resolvePostCustomerSignUpPath", () => {
  it("sends customers to /customer by default", () => {
    expect(resolvePostCustomerSignUpPath(null)).toBe("/customer");
  });

  it("honours allowed customer redirectedFrom paths", () => {
    expect(resolvePostCustomerSignUpPath("/customer/book")).toBe("/customer/book");
  });

  it("ignores non-customer redirect targets", () => {
    expect(resolvePostCustomerSignUpPath("/admin")).toBe("/customer");
  });
});
