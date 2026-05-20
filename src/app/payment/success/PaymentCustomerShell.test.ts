import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("PaymentCustomerShell", () => {
  it("uses customer dashboard shell without wizard stepper", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/payment/success/PaymentCustomerShell.tsx"),
      "utf8",
    );
    expect(source).toContain("DashboardShell");
    expect(source).toContain("CUSTOMER_DASHBOARD_NAV");
    expect(source).not.toContain("WizardStepper");
    expect(source).not.toContain("Book a clean");
  });
});
