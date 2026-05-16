import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PaymentSuccessVerifier", () => {
  it("calls verify API only — never mutates booking status client-side", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/payment/success/PaymentSuccessVerifier.tsx"),
      "utf8",
    );
    expect(source).toContain("/api/paystack/verify");
    expect(source).not.toMatch(/bookings\.status/);
    expect(source).not.toMatch(/FINALIZE_PAYMENT/);
    expect(source).not.toMatch(/executeBookingCommand/);
    expect(source).not.toMatch(/\.from\(["']bookings["']\)/);
    expect(source).toContain("customerBookingDetailPath");
  });
});
