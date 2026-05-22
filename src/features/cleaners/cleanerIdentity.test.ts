import { describe, expect, it } from "vitest";
import {
  buildCleanerIdentityEmail,
  isValidCleanerIdentityEmail,
  normalizeCleanerPhoneIdentity,
  SHALEAN_CLEANER_EMAIL_DOMAIN,
} from "./cleanerIdentity";

describe("cleanerIdentity", () => {
  it("normalizes phone to local login digits", () => {
    expect(normalizeCleanerPhoneIdentity("+27810768318")).toBe("0810768318");
    expect(normalizeCleanerPhoneIdentity("081 076 8318")).toBe("0810768318");
  });

  it("builds deterministic shalean.co.za identity email", () => {
    expect(buildCleanerIdentityEmail("+27810768318")).toBe(
      `0810768318@${SHALEAN_CLEANER_EMAIL_DOMAIN}`,
    );
    expect(buildCleanerIdentityEmail("+27 79 202 2648")).toBe(
      `0792022648@${SHALEAN_CLEANER_EMAIL_DOMAIN}`,
    );
  });

  it("returns null for invalid phone", () => {
    expect(buildCleanerIdentityEmail("")).toBeNull();
    expect(buildCleanerIdentityEmail("123")).toBeNull();
    expect(buildCleanerIdentityEmail("0111234567")).toBeNull();
  });

  it("always ends with shalean.co.za when present", () => {
    const email = buildCleanerIdentityEmail("0792022648");
    expect(email).not.toBeNull();
    expect(email!.endsWith("@shalean.co.za")).toBe(true);
  });

  it("validates cleaner identity emails", () => {
    expect(isValidCleanerIdentityEmail("0792022648@shalean.co.za")).toBe(true);
    expect(isValidCleanerIdentityEmail("user@gmail.com")).toBe(false);
  });
});
