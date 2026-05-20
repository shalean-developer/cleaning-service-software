import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PaymentVerificationShell", () => {
  it("delegates to customer dashboard shell for payment return", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/payment/success/PaymentVerificationShell.tsx"),
      "utf8",
    );
    expect(source).toContain("PaymentCustomerShell");
    expect(source).not.toContain("WizardStepper");
    expect(source).not.toContain("getWizardShellClass");
    expect(source).toContain("PaymentVerifyingPanel");
    expect(source).toContain("PAYMENT_VERIFY_STATUS_MESSAGE");
    expect(source).not.toMatch(/progress-bar|fake.*progress/i);
  });
});
