import { describe, expect, it } from "vitest";
import { buildBookingZohoReferenceNumber } from "./sales";

describe("sales helpers", () => {
  it("builds stable booking reference numbers", () => {
    expect(buildBookingZohoReferenceNumber("booking-123")).toBe("SHALEAN-BKG-booking-123");
  });
});
