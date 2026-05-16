import { describe, expect, it } from "vitest";
import {
  buildCustomerSignupMetadata,
  resolvePostCustomerSignUpPath,
} from "./customerSignup";

describe("buildCustomerSignupMetadata", () => {
  it("includes full_name only", () => {
    expect(buildCustomerSignupMetadata("  Jane Doe  ")).toEqual({ full_name: "Jane Doe" });
  });

  it("does not accept or emit role", () => {
    const metadata = buildCustomerSignupMetadata("Test User");
    expect(metadata).not.toHaveProperty("role");
    expect(Object.keys(metadata)).toEqual(["full_name"]);
  });

  it("cannot be used to inject role via object spread from user input", () => {
    const malicious = { full_name: "Evil", role: "admin" } as { full_name: string; role: string };
    const metadata = buildCustomerSignupMetadata(malicious.full_name);
    expect(metadata).toEqual({ full_name: "Evil" });
    expect(metadata).not.toHaveProperty("role");
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
