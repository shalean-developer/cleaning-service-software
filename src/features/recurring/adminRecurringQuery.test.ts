import { describe, expect, it } from "vitest";
import { buildAdminRecurringHref, parseAdminRecurringListQuery } from "./adminRecurringQuery";

describe("parseAdminRecurringListQuery", () => {
  it("parses status and payment filters", () => {
    expect(
      parseAdminRecurringListQuery({ status: "active", payment: "required", q: " Sea " }),
    ).toEqual({
      status: "active",
      frequency: undefined,
      paymentRequired: true,
      overdueUnpaid: false,
      openRequests: false,
      nextSevenDays: false,
      search: "Sea",
    });
  });

  it("builds href with filters", () => {
    expect(
      buildAdminRecurringHref({ status: "paused", frequency: "monthly" }),
    ).toBe("/admin/recurring?status=paused&frequency=monthly");
  });

  it("parses overdue and open request filters", () => {
    expect(
      parseAdminRecurringListQuery({ overdue: "1", requests: "open", next7: "1" }),
    ).toEqual({
      status: undefined,
      frequency: undefined,
      paymentRequired: false,
      overdueUnpaid: true,
      openRequests: true,
      nextSevenDays: true,
      search: undefined,
    });
  });
});
