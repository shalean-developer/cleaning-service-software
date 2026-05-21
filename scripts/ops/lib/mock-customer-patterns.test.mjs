import { describe, expect, it } from "vitest";
import {
  classifyMockCustomer,
  hasExplicitMockCustomerEmail,
  isMockCustomerEmail,
  isShaleanCoZaCustomerEmail,
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

  it("keeps customer@shalean.co.za permanently even with mock name/company/phone", () => {
    const classification = classifyMockCustomer({
      email: "customer@shalean.co.za",
      fullName: "E2E Test Customer",
      companyName: "test_e2e_customer",
      phone: "test_e2e_cleaner_phone",
    });
    expect(classification.mock).toBe(false);
    expect(classification.reasons).toContain("protected");
    expect(
      resolveMockCustomerDecision(
        classification,
        { paidProductionBookings: 0, customerAuditCount: 0 },
        false,
        "customer@shalean.co.za",
      ),
    ).toBe("KEEP");
  });

  it("never DELETEs @shalean.co.za accounts matched only by weak name/phone", () => {
    const classification = classifyMockCustomer({
      email: "jane.doe@shalean.co.za",
      fullName: "Demo Customer",
      companyName: "Acme Holdings",
      phone: "test_e2e_cleaner_phone",
    });
    expect(classification.mock).toBe(false);
    expect(isShaleanCoZaCustomerEmail("jane.doe@shalean.co.za")).toBe(true);
    expect(hasExplicitMockCustomerEmail("jane.doe@shalean.co.za")).toBe(false);
    expect(
      resolveMockCustomerDecision(
        classification,
        { paidProductionBookings: 2, customerAuditCount: 0 },
        false,
        "jane.doe@shalean.co.za",
      ),
    ).toBe("KEEP");
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
      resolveMockCustomerDecision(
        classification,
        { paidProductionBookings: 2, customerAuditCount: 0 },
        false,
        "test_e2e_customer@shalean.co.za",
      ),
    ).toBe("DELETE");
  });

  it("marks weak mock with paid production as REVIEW (non-shalean email)", () => {
    const classification = classifyMockCustomer({
      email: "jane.doe@example.com",
      fullName: "Demo Customer",
      companyName: "Acme Corp",
      phone: null,
    });
    expect(classification.mock).toBe(true);
    expect(classification.strong).toBe(false);
    expect(
      resolveMockCustomerDecision(
        classification,
        { paidProductionBookings: 1, customerAuditCount: 0 },
        false,
        "jane.doe@example.com",
      ),
    ).toBe("REVIEW");
  });

  it("DELETEs shalean email when company_name is test_phase%", () => {
    const classification = classifyMockCustomer({
      email: "someone@shalean.co.za",
      fullName: "Integration User",
      companyName: "test_phase2_customer_seed",
      phone: null,
    });
    expect(classification.mock).toBe(true);
    expect(classification.reasons).toContain("company");
    expect(classification.strong).toBe(true);
    expect(
      isStrongMockCustomerSignal({
        email: "someone@shalean.co.za",
        companyName: "test_phase1_integration_seed",
      }),
    ).toBe(true);
  });

  it("DELETEs customer when linked profile is mock", () => {
    const classification = classifyMockCustomer({
      email: "someone@shalean.co.za",
      fullName: "Production Name",
      companyName: "Acme Holdings",
      phone: null,
      linkedProfileMock: true,
    });
    expect(classification.mock).toBe(true);
    expect(classification.reasons).toContain("linked_profile");
  });
});
