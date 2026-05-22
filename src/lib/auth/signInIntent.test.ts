import { describe, expect, it } from "vitest";
import {
  isCleanerSignInIntent,
  isCustomerSignInIntent,
  resolveSignInPageCopy,
} from "./signInIntent";

describe("signInIntent", () => {
  it("detects cleaner paths from redirectedFrom", () => {
    expect(isCleanerSignInIntent("/cleaner/offers")).toBe(true);
    expect(isCleanerSignInIntent("/cleaner/jobs/abc")).toBe(true);
    expect(isCleanerSignInIntent("/customer/book")).toBe(false);
  });

  it("detects customer paths from redirectedFrom", () => {
    expect(isCustomerSignInIntent("/customer/book")).toBe(true);
    expect(isCustomerSignInIntent("/cleaner")).toBe(false);
  });

  it("returns cleaner-specific sign-in copy for cleaner intent", () => {
    const copy = resolveSignInPageCopy("/cleaner/offers");
    expect(copy.title).toBe("Cleaner sign in");
    expect(copy.subtitle).toContain("jobs");
    expect(copy.helperText).toContain("onboarding");
  });

  it("retains customer copy for customer redirect targets", () => {
    const copy = resolveSignInPageCopy("/customer/book");
    expect(copy.title).toBe("Sign in");
    expect(copy.subtitle).toContain("bookings");
  });
});
