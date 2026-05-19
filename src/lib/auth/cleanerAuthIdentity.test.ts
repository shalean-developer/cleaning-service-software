import { describe, expect, it } from "vitest";
import {
  buildShaleanCleanerAuthEmail,
  resolveSignInEmail,
  SHALEAN_CLEANER_EMAIL_DOMAIN,
  zaMobileToLocalLoginDigits,
} from "./cleanerAuthIdentity";

describe("zaMobileToLocalLoginDigits", () => {
  it("converts E.164 to 0-prefixed local digits", () => {
    expect(zaMobileToLocalLoginDigits("+27792022648")).toBe("0792022648");
    expect(zaMobileToLocalLoginDigits("0792022648")).toBe("0792022648");
  });

  it("returns null for invalid numbers", () => {
    expect(zaMobileToLocalLoginDigits("0111234567")).toBeNull();
  });
});

describe("buildShaleanCleanerAuthEmail", () => {
  it("builds shalean.co.za email from local mobile", () => {
    expect(buildShaleanCleanerAuthEmail("0792022648")).toBe(
      `0792022648@${SHALEAN_CLEANER_EMAIL_DOMAIN}`,
    );
  });

  it("builds email from formatted international input", () => {
    expect(buildShaleanCleanerAuthEmail("+27 79 202 2648")).toBe(
      `0792022648@${SHALEAN_CLEANER_EMAIL_DOMAIN}`,
    );
  });

  it("returns null for invalid phone", () => {
    expect(buildShaleanCleanerAuthEmail("not-a-phone")).toBeNull();
  });
});

describe("resolveSignInEmail", () => {
  it("passes through customer email unchanged", () => {
    const result = resolveSignInEmail("Customer@Example.com");
    expect(result).toEqual({ ok: true, email: "customer@example.com" });
  });

  it("passes through generated shalean email unchanged", () => {
    const result = resolveSignInEmail("0792022648@shalean.co.za");
    expect(result).toEqual({ ok: true, email: "0792022648@shalean.co.za" });
  });

  it("maps bare mobile to shalean auth email", () => {
    expect(resolveSignInEmail("0792022648")).toEqual({
      ok: true,
      email: "0792022648@shalean.co.za",
    });
    expect(resolveSignInEmail("+27 79 202 2648")).toEqual({
      ok: true,
      email: "0792022648@shalean.co.za",
    });
  });

  it("rejects invalid identifier without @", () => {
    const result = resolveSignInEmail("123");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/valid email|mobile/i);
    }
  });

  it("rejects invalid email format", () => {
    const result = resolveSignInEmail("bad@@example.com");
    expect(result.ok).toBe(false);
  });
});
