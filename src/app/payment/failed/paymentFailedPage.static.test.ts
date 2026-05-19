import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("payment failed page (static safety)", () => {
  it("does not call payment APIs or mutate bookings from the page layer", () => {
    const pageSource = readFileSync(
      path.join(process.cwd(), "src/app/payment/failed/page.tsx"),
      "utf8",
    );
    const contentSource = readFileSync(
      path.join(process.cwd(), "src/app/payment/failed/PaymentFailedPageContent.tsx"),
      "utf8",
    );

    for (const source of [pageSource, contentSource]) {
      expect(source).not.toMatch(/\/api\/paystack/);
      expect(source).not.toMatch(/fetch\s*\(/);
      expect(source).not.toMatch(/executeBookingCommand/);
      expect(source).not.toMatch(/FINALIZE_PAYMENT/);
      expect(source).not.toMatch(/MARK_PAYMENT_FAILED/);
    }

    expect(pageSource).toContain("buildPaymentFailedPageModel");
    expect(contentSource).toContain("Open booking to complete payment");
    expect(contentSource).toContain("Go to my bookings");
  });
});
