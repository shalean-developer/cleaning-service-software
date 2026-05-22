import { describe, expect, it } from "vitest";
import {
  normalizeSouthAfricanPhone,
  SOUTH_AFRICAN_MOBILE_INVALID_MESSAGE,
} from "./southAfricanPhone";

describe("normalizeSouthAfricanPhone", () => {
  it("accepts common South African mobile formats", () => {
    expect(normalizeSouthAfricanPhone("0821234567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("082 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("+27 82 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("27821234567")).toBe("+27821234567");
  });

  it("rejects invalid or too-short numbers", () => {
    expect(normalizeSouthAfricanPhone("123")).toBeNull();
    expect(normalizeSouthAfricanPhone("0111234567")).toBeNull();
    expect(normalizeSouthAfricanPhone("")).toBeNull();
  });

  it("exposes a stable invalid-message constant for forms", () => {
    expect(SOUTH_AFRICAN_MOBILE_INVALID_MESSAGE).toBe(
      "Enter a valid South African mobile number.",
    );
  });
});
