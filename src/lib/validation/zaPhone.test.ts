import { describe, expect, it } from "vitest";
import {
  formatZaMobileForDisplay,
  isValidZaMobilePhone,
  maskZaMobilePhone,
  normalizeZaMobilePhone,
} from "./zaPhone";

describe("normalizeZaMobilePhone", () => {
  it("accepts local 0-prefixed mobile", () => {
    expect(normalizeZaMobilePhone("082 123 4567")).toBe("+27821234567");
  });

  it("accepts national 9-digit mobile", () => {
    expect(normalizeZaMobilePhone("821234567")).toBe("+27821234567");
  });

  it("accepts country code without plus", () => {
    expect(normalizeZaMobilePhone("27821234567")).toBe("+27821234567");
  });

  it("accepts E.164", () => {
    expect(normalizeZaMobilePhone("+27821234567")).toBe("+27821234567");
  });

  it("rejects landline and invalid lengths", () => {
    expect(normalizeZaMobilePhone("0111234567")).toBeNull();
    expect(normalizeZaMobilePhone("123")).toBeNull();
    expect(normalizeZaMobilePhone("")).toBeNull();
  });
});

describe("isValidZaMobilePhone", () => {
  it("mirrors normalization", () => {
    expect(isValidZaMobilePhone("0821234567")).toBe(true);
    expect(isValidZaMobilePhone("0111234567")).toBe(false);
  });
});

describe("formatZaMobileForDisplay", () => {
  it("formats E.164 for display", () => {
    expect(formatZaMobileForDisplay("+27821234567")).toBe("082 123 4567");
  });
});

describe("maskZaMobilePhone", () => {
  it("masks middle digits", () => {
    expect(maskZaMobilePhone("+27821234567")).toBe("+27 ** *** 4567");
  });
});
