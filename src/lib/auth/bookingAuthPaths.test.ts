import { describe, expect, it } from "vitest";
import { SIGN_UP_PATH } from "./customerSignup";
import { SIGN_IN_PATH } from "./redirects";
import { buildAuthPathWithRedirect } from "./bookingAuthPaths";

describe("buildAuthPathWithRedirect", () => {
  it("returns base path when redirect is missing", () => {
    expect(buildAuthPathWithRedirect(SIGN_IN_PATH, null)).toBe("/sign-in");
  });

  it("preserves customer booking redirect through sign-up", () => {
    expect(buildAuthPathWithRedirect(SIGN_UP_PATH, "/customer/book/regular-cleaning")).toBe(
      "/sign-up?redirectedFrom=%2Fcustomer%2Fbook%2Fregular-cleaning",
    );
  });

  it("ignores unsafe redirect targets", () => {
    expect(buildAuthPathWithRedirect(SIGN_IN_PATH, "//evil.example")).toBe("/sign-in");
  });
});
