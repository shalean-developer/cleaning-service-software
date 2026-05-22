import { describe, expect, it } from "vitest";
import {
  isValidSupportNotificationCtaPath,
  isValidSupportNotificationCtaUrl,
} from "./validateSupportNotificationCta";

describe("validateSupportNotificationCta", () => {
  it("accepts same-origin customer booking paths", () => {
    expect(isValidSupportNotificationCtaPath("/customer/bookings/abc")).toBe(true);
    expect(isValidSupportNotificationCtaPath("/customer/bookings/recurring/series-1")).toBe(true);
  });

  it("rejects external and protocol-relative paths", () => {
    expect(isValidSupportNotificationCtaPath("//evil.com")).toBe(false);
    expect(isValidSupportNotificationCtaPath("https://evil.com/x")).toBe(false);
    expect(isValidSupportNotificationCtaPath("/admin/other")).toBe(false);
  });

  it("validates full CTA URLs against app base", () => {
    process.env.APP_BASE_URL = "https://app.example.com";
    expect(
      isValidSupportNotificationCtaUrl(
        "https://app.example.com/customer/bookings/b1#booking-support",
      ),
    ).toBe(true);
    expect(isValidSupportNotificationCtaUrl("https://other.com/customer/bookings/b1")).toBe(
      false,
    );
  });
});
