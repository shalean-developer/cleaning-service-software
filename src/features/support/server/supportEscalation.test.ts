import { describe, expect, it } from "vitest";
import {
  buildSupportEscalationContext,
  detectSupportEscalations,
} from "./supportEscalation";

describe("supportEscalation", () => {
  it("flags multiple requests on same booking", () => {
    const items = [
      {
        id: "a",
        source: "booking_support" as const,
        status: "open",
        requestType: "payment_help",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookingId: "book-1",
        seriesId: null,
        customerId: "c1",
        slaStatus: "healthy" as const,
        ageMinutes: 30,
        upcomingVisitHours: null,
      },
      {
        id: "b",
        source: "booking_support" as const,
        status: "open",
        requestType: "general_message",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookingId: "book-1",
        seriesId: null,
        customerId: "c1",
        slaStatus: "healthy" as const,
        ageMinutes: 20,
        upcomingVisitHours: null,
      },
    ];
    const ctx = buildSupportEscalationContext(items);
    const reasons = detectSupportEscalations(items[0]!, ctx);
    expect(reasons).toContain("Multiple requests on same booking");
  });

  it("flags repeated cleaner issues", () => {
    const items = [
      {
        id: "1",
        source: "booking_support" as const,
        status: "open",
        requestType: "cleaner_issue",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookingId: "b1",
        seriesId: null,
        customerId: "cust",
        slaStatus: "healthy" as const,
        ageMinutes: 10,
        upcomingVisitHours: null,
      },
      {
        id: "2",
        source: "booking_support" as const,
        status: "acknowledged",
        requestType: "cleaner_issue",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bookingId: "b2",
        seriesId: null,
        customerId: "cust",
        slaStatus: "healthy" as const,
        ageMinutes: 5,
        upcomingVisitHours: null,
      },
    ];
    const ctx = buildSupportEscalationContext(items);
    expect(detectSupportEscalations(items[0]!, ctx)).toContain(
      "Repeated cleaner issues for customer",
    );
  });
});
