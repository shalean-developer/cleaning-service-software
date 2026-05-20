import { describe, expect, it } from "vitest";
import {
  classifyMockCustomer,
  isMockCustomerEmail,
  isStrongMockCustomerSignal,
  resolveMockCustomerDecision,
} from "./mock-customer-patterns.mjs";

describe("mock-customer-patterns", () => {
  it("flags E2E and phase integration emails as mock", () => {
    expect(isMockCustomerEmail("test_e2e_customer@shalean.co.za")).toBe(true);
    expect(isMockCustomerEmail("test_phase1_integration_seed@shalean.co.za")).toBe(true);
    expect(isMockCustomerEmail("user.mock@example.com")).toBe(true);
  });

  it("never flags protected production admin email", () => {
    const result = classifyMockCustomer({
      email: "admin@shalean.co.za",
      fullName: "Test Admin",
      companyName: "test_e2e_customer",
      phone: null,
    });
    expect(result.mock).toBe(false);
    expect(result.reasons).toContain("protected");
  });

  it("marks strong E2E customers for DELETE even with paid counts", () => {
    const classification = classifyMockCustomer({
      email: "test_e2e_customer@shalean.co.za",
      fullName: "E2E Test Customer",
      companyName: "test_e2e_customer",
      phone: "test_e2e_cleaner_phone",
    });
    expect(classification.strong).toBe(true);
    expect(
      resolveMockCustomerDecision(classification, {
        paidProductionBookings: 2,
        customerAuditCount: 0,
      }, false),
    ).toBe("DELETE");
  });

  it("marks weak mock with paid production as REVIEW", () => {
    const classification = classifyMockCustomer({
      email: "jane.doe@shalean.co.za",
      fullName: "Demo Customer",
      companyName: "Acme Corp",
      phone: null,
    });
    expect(classification.mock).toBe(true);
    expect(classification.strong).toBe(false);
    expect(
      resolveMockCustomerDecision(classification, {
        paidProductionBookings: 1,
        customerAuditCount: 0,
      }, false),
    ).toBe("REVIEW");
  });

  it("detects strong signal from company alone", () => {
    expect(
      isStrongMockCustomerSignal({
        email: "someone@shalean.co.za",
        companyName: "test_phase1_integration_seed",
      }),
    ).toBe(true);
  });
});
