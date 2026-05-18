import { describe, expect, it } from "vitest";
import {
  readContactPhoneFromMetadata,
  validateBookingContactPhoneMetadata,
} from "./validateBookingContactPhone";

describe("validateBookingContactPhoneMetadata", () => {
  it("accepts valid contactPhone in metadata", () => {
    const result = validateBookingContactPhoneMetadata({
      contactPhone: "+27821234567",
    });
    expect(result).toEqual({ ok: true, contactPhone: "+27821234567" });
  });

  it("rejects missing or invalid phone", () => {
    expect(validateBookingContactPhoneMetadata({}).ok).toBe(false);
    expect(validateBookingContactPhoneMetadata({ contactPhone: "011" }).ok).toBe(
      false,
    );
  });
});

describe("readContactPhoneFromMetadata", () => {
  it("reads customerPhone alias", () => {
    expect(readContactPhoneFromMetadata({ customerPhone: "0821234567" })).toBe(
      "+27821234567",
    );
  });
});
