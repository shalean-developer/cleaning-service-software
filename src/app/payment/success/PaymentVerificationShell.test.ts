import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PaymentVerificationShell", () => {
  it("reuses booking wizard shell and checkout stepper", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/payment/success/PaymentVerificationShell.tsx"),
      "utf8",
    );
    expect(source).toContain("Book a clean");
    expect(source).toContain("Shalean Cleaning Services");
    expect(source).toContain('current="checkout"');
    expect(source).toContain("getWizardShellClass");
    expect(source).toContain("PaymentVerifyingPanel");
    expect(source).toContain("Confirming payment");
    expect(source).not.toMatch(/progress-bar|fake.*progress/i);
  });
});
