import { describe, expect, it } from "vitest";
import { formatOfferExpiryDisplay } from "./formatOfferExpiryDisplay";

const baseNow = new Date("2026-05-18T12:00:00.000Z");

describe("formatOfferExpiryDisplay", () => {
  it("formats hours remaining as respond within Nh", () => {
    const result = formatOfferExpiryDisplay({
      expiresAt: "2026-05-18T14:30:00.000Z",
      now: baseNow,
    });
    expect(result.relativeLabel).toBe("Respond within 2h");
    expect(result.urgency).toBe("normal");
    expect(result.isUrgent).toBe(false);
    expect(result.isExpired).toBe(false);
  });

  it("formats minutes remaining and marks warning under one hour", () => {
    const result = formatOfferExpiryDisplay({
      expiresAt: "2026-05-18T12:45:00.000Z",
      now: baseNow,
    });
    expect(result.relativeLabel).toBe("Respond within 45m");
    expect(result.urgency).toBe("warning");
    expect(result.isUrgent).toBe(true);
  });

  it("returns expired state", () => {
    const result = formatOfferExpiryDisplay({
      expiresAt: "2026-05-18T11:00:00.000Z",
      isExpired: true,
      now: baseNow,
    });
    expect(result.relativeLabel).toBe("Expired");
    expect(result.urgency).toBe("expired");
    expect(result.isExpired).toBe(true);
  });

  it("includes absolute en-ZA label and aria-label with absolute time", () => {
    const result = formatOfferExpiryDisplay({
      expiresAt: "2026-05-18T14:00:00.000Z",
      now: baseNow,
    });
    expect(result.absoluteLabel).toMatch(/2026/);
    expect(result.ariaLabel).toContain("Expires");
    expect(result.ariaLabel).toContain(result.absoluteLabel);
  });

  it("returns null labels when expiresAt is missing", () => {
    const result = formatOfferExpiryDisplay({ expiresAt: null, now: baseNow });
    expect(result.relativeLabel).toBeNull();
    expect(result.absoluteLabel).toBeNull();
    expect(result.ariaLabel).toBeNull();
  });
});
