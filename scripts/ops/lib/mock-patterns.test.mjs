import { describe, expect, it } from "vitest";
import {
  classifyMockCustomer,
  classifyMockProfile,
  containsMockToken,
  isMockBookingMetadata,
  isProtectedOperationalEmail,
  resolveMockBookingDecision,
  resolveMockCleanerDecision,
  resolveMockProfileDecision,
} from "./mock-patterns.mjs";

describe("mock-patterns", () => {
  it("DELETEs Phase 2 profile display name", () => {
    const pc = classifyMockProfile({
      email: "test_phase2_admin@shalean.co.za",
      fullName: "Phase 2 Admin Seed",
      role: "admin",
    });
    expect(pc.mock).toBe(true);
    expect(resolveMockProfileDecision(pc)).toBe("DELETE");
  });

  it("DELETEs test_phase2 customer company", () => {
    const cc = classifyMockCustomer({
      email: "test_phase2_cust@shalean.co.za",
      fullName: "Integration User",
      companyName: "test_phase2_customer_acme",
      phone: null,
    });
    expect(cc.mock).toBe(true);
    expect(cc.strong).toBe(true);
  });

  it("DELETEs booking with service_uid containing test_phase2", () => {
    const cc = classifyMockCustomer({
      email: "jane@example.com",
      fullName: "Jane",
      companyName: "Acme",
      phone: null,
    });
    expect(
      resolveMockBookingDecision({
        status: "draft",
        metadata: { service_uid: "svc_test_phase2_regular" },
        customerClassification: cc,
        hasPaidPayment: false,
      }),
    ).toBe("DELETE");
  });

  it("KEEPs customer@shalean.co.za", () => {
    const cc = classifyMockCustomer({
      email: "customer@shalean.co.za",
      fullName: "E2E Test Customer",
      companyName: "test_e2e_customer",
      phone: null,
    });
    expect(cc.mock).toBe(false);
    expect(
      resolveMockBookingDecision({
        status: "completed",
        metadata: {},
        customerClassification: cc,
        customerEmail: "customer@shalean.co.za",
        hasPaidPayment: true,
      }),
    ).toBe("KEEP");
  });

  it("KEEPs non-test @shalean.co.za profile with only weak demo name", () => {
    const pc = classifyMockProfile({
      email: "jane.doe@shalean.co.za",
      fullName: "Demo Customer",
      role: "customer",
    });
    expect(pc.mock).toBe(false);
    expect(resolveMockProfileDecision(pc)).toBe("KEEP");
  });

  it("REVIEWs paid production booking for weak mock customer", () => {
    const cc = classifyMockCustomer({
      email: "jane@example.com",
      fullName: "Demo Customer",
      companyName: "Acme",
      phone: null,
    });
    expect(cc.mock).toBe(true);
    expect(
      resolveMockBookingDecision({
        status: "completed",
        metadata: {},
        customerClassification: cc,
        customerEmail: "jane@example.com",
        hasPaidPayment: true,
      }),
    ).toBe("REVIEW");
  });

  it("DELETEs bookings when linked mock profile propagates to customer", () => {
    const profile = classifyMockProfile({
      email: "test_phase2_cust@shalean.co.za",
      fullName: "Phase 2 Customer",
      role: "customer",
    });
    const cc = classifyMockCustomer({
      email: "test_phase2_cust@shalean.co.za",
      fullName: "Phase 2 Customer",
      companyName: "Acme Ltd",
      phone: null,
      linkedProfileMock: profile.mock,
    });
    expect(cc.mock).toBe(true);
    expect(
      resolveMockBookingDecision({
        status: "completed",
        metadata: {},
        customerClassification: cc,
        hasPaidPayment: true,
      }),
    ).toBe("DELETE");
  });

  it("detects mock tokens in booking metadata", () => {
    expect(isMockBookingMetadata({ source: "e2e_smoke", phase: "4" })).toBe(true);
    expect(isMockBookingMetadata({ note: "regular booking" })).toBe(false);
  });

  it("flags phase/e2e/sandbox in free text", () => {
    expect(containsMockToken("paystack_phase1_sandbox")).toBe(true);
    expect(containsMockToken("BK-2026-001")).toBe(false);
  });

  it("DELETEs strong-mock customer bookings regardless of paid flag", () => {
    const cc = classifyMockCustomer({
      email: "test_e2e_customer@shalean.co.za",
      fullName: "E2E Test Customer",
      companyName: "test_e2e_customer",
      phone: null,
    });
    expect(
      resolveMockBookingDecision({
        status: "completed",
        metadata: {},
        customerClassification: cc,
        customerEmail: "test_e2e_customer@shalean.co.za",
        companyName: "test_e2e_customer",
        hasPaidPayment: true,
      }),
    ).toBe("DELETE");
  });

  it("REVIEWs mock cleaner linked to paid real-customer bookings", () => {
    expect(
      resolveMockCleanerDecision({
        classification: { mock: true, reasons: ["email"] },
        paidRealCustomerBookings: 1,
        alreadyPurged: false,
      }),
    ).toBe("REVIEW");
  });

  it("KEEPs Princess Saidi and Farai Chitekedza by name", async () => {
    const { classifyMockCleaner, isProtectedRealCleanerName } = await import(
      "./mock-cleaner-patterns.mjs"
    );
    expect(isProtectedRealCleanerName({ fullName: "Princess Saidi" })).toBe(true);
    expect(isProtectedRealCleanerName({ fullName: "Farai Chitekedza" })).toBe(true);
    expect(
      classifyMockCleaner({
        email: "test_e2e@example.com",
        fullName: "Princess Saidi",
        phone: null,
      }).mock,
    ).toBe(false);
    expect(
      resolveMockCleanerDecision({
        classification: classifyMockCleaner({
          email: "test@example.com",
          fullName: "Farai Chitekedza",
          phone: null,
        }),
        alreadyPurged: false,
      }),
    ).toBe("KEEP");
  });

  it("REVIEWs mock cleaner with payout earnings", () => {
    expect(
      resolveMockCleanerDecision({
        classification: { mock: true, reasons: ["email"] },
        payoutEarningCount: 2,
        alreadyPurged: false,
      }),
    ).toBe("REVIEW");
  });

  it("does not treat protected admin as operational block incorrectly", () => {
    expect(isProtectedOperationalEmail("admin@shalean.co.za")).toBe(true);
    expect(isProtectedOperationalEmail("real.user@shalean.co.za")).toBe(false);
  });
});
