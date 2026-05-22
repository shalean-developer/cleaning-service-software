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
    expect("helperText" in copy).toBe(false);
  });

  it("retains customer copy for customer redirect targets", () => {
    const copy = resolveSignInPageCopy("/customer/book");
    expect(copy.title).toBe("Welcome back");
    expect(copy.subtitle).toContain("bookings");
    expect(copy.subtitle).toContain("cleaning schedule");
  });
});
