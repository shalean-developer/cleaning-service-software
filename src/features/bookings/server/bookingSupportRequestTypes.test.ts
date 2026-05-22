import { describe, expect, it } from "vitest";
import {
  customerBookingSupportHref,
  customerHubSupportQuickLinks,
  isBookingSupportRequestTypeAllowed,
  listAvailableBookingSupportActions,
  parseBookingSupportQueryParam,
  requestTypeFromSupportQuery,
} from "./bookingSupportRequestTypes";

describe("bookingSupportRequestTypes", () => {
  const upcomingOneOff = {
    status: "confirmed" as const,
    paymentStatus: "paid" as const,
    isSeriesVisit: false,
    hasAssignedCleaner: true,
  };

  it("parses support query params", () => {
    expect(parseBookingSupportQueryParam("reschedule")).toBe("reschedule");
    expect(parseBookingSupportQueryParam("message")).toBe("message");
    expect(parseBookingSupportQueryParam("invalid")).toBeNull();
  });

  it("maps message query to general_message request type", () => {
    expect(requestTypeFromSupportQuery("message")).toBe("general_message");
  });

  it("shows reschedule and cancel for upcoming one-off bookings", () => {
    const actions = listAvailableBookingSupportActions(upcomingOneOff);
    expect(actions.map((a) => a.id)).toContain("reschedule");
    expect(actions.map((a) => a.id)).toContain("cancel");
  });

  it("hides reschedule and cancel for recurring series visits", () => {
    const actions = listAvailableBookingSupportActions({
      ...upcomingOneOff,
      isSeriesVisit: true,
    });
    expect(actions.map((a) => a.id)).not.toContain("reschedule");
    expect(actions.map((a) => a.id)).not.toContain("cancel");
  });

  it("shows payment help for payment_failed", () => {
    const actions = listAvailableBookingSupportActions({
      ...upcomingOneOff,
      status: "payment_failed",
      paymentStatus: "failed",
    });
    expect(actions.map((a) => a.id)).toContain("payment_help");
  });

  it("shows service issue after completion", () => {
    const actions = listAvailableBookingSupportActions({
      ...upcomingOneOff,
      status: "paid_out",
      hasAssignedCleaner: false,
    });
    expect(actions.map((a) => a.id)).toContain("service_issue");
    expect(actions.map((a) => a.id)).not.toContain("reschedule");
  });

  it("always allows general_message", () => {
    expect(
      isBookingSupportRequestTypeAllowed(
        { status: "cancelled", paymentStatus: null, isSeriesVisit: false, hasAssignedCleaner: false },
        "general_message",
      ),
    ).toBe(true);
  });

  it("builds deep links for hub quick actions", () => {
    const oneOff = customerHubSupportQuickLinks({
      id: "b-1",
      isSeriesVisit: false,
      seriesId: null,
    });
    expect(oneOff.reschedule).toBe("/customer/bookings/b-1?support=reschedule");
    expect(oneOff.message).toBe("/customer/bookings/b-1?support=message");

    const recurring = customerHubSupportQuickLinks({
      id: "b-2",
      isSeriesVisit: true,
      seriesId: "s-1",
    });
    expect(recurring.reschedule).toBe("/customer/bookings/recurring/s-1");
    expect(recurring.message).toBe("/customer/bookings/b-2?support=message");
  });

  it("customerBookingSupportHref uses support query", () => {
    expect(customerBookingSupportHref("abc", "cancel")).toBe(
      "/customer/bookings/abc?support=cancel",
    );
  });
});
