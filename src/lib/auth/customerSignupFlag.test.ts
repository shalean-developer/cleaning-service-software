import { afterEach, describe, expect, it } from "vitest";
import { isCustomerSignupEnabled } from "./customerSignupFlag";

describe("isCustomerSignupEnabled", () => {
  const prev = process.env.ENABLE_CUSTOMER_SIGNUP;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.ENABLE_CUSTOMER_SIGNUP;
    } else {
      process.env.ENABLE_CUSTOMER_SIGNUP = prev;
    }
  });

  it("is disabled by default", () => {
    delete process.env.ENABLE_CUSTOMER_SIGNUP;
    expect(isCustomerSignupEnabled()).toBe(false);
  });

  it("is disabled for empty or false-like values", () => {
    process.env.ENABLE_CUSTOMER_SIGNUP = "";
    expect(isCustomerSignupEnabled()).toBe(false);
    process.env.ENABLE_CUSTOMER_SIGNUP = "false";
    expect(isCustomerSignupEnabled()).toBe(false);
    process.env.ENABLE_CUSTOMER_SIGNUP = "0";
    expect(isCustomerSignupEnabled()).toBe(false);
  });

  it("is enabled for true, 1, and yes", () => {
    process.env.ENABLE_CUSTOMER_SIGNUP = "true";
    expect(isCustomerSignupEnabled()).toBe(true);
    process.env.ENABLE_CUSTOMER_SIGNUP = "TRUE";
    expect(isCustomerSignupEnabled()).toBe(true);
    process.env.ENABLE_CUSTOMER_SIGNUP = "1";
    expect(isCustomerSignupEnabled()).toBe(true);
    process.env.ENABLE_CUSTOMER_SIGNUP = "yes";
    expect(isCustomerSignupEnabled()).toBe(true);
  });
});
