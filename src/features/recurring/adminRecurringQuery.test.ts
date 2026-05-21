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
      search: "Sea",
    });
  });

  it("builds href with filters", () => {
    expect(
      buildAdminRecurringHref({ status: "paused", frequency: "monthly" }),
    ).toBe("/admin/recurring?status=paused&frequency=monthly");
  });
});
