import { describe, expect, it } from "vitest";

/**
 * Customer recurring requests must never auto-execute destructive series actions.
 * Enforcement is in recurringSeriesCommandService (audit + queue row only).
 */
describe("recurring support request workflow contract", () => {
  it("customer request route only calls customerRequestRecurringSeriesChange", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile(
      "src/app/api/customer/recurring/request/route.ts",
      "utf8",
    );
    expect(route).toContain("customerRequestRecurringSeriesChange");
    expect(route).not.toContain("pauseBookingSeries");
    expect(route).not.toContain("cancelEntireBookingSeries");
    expect(route).not.toContain("rescheduleSeriesNextOccurrence");
  });

  it("admin resolve route exists for support queue", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile(
      "src/app/api/admin/recurring/requests/[requestId]/resolve/route.ts",
      "utf8",
    );
    expect(route).toContain("adminResolveRecurringSeriesRequest");
  });

  it("migration defines request status workflow", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile(
      "supabase/migrations/20260605120000_recurring_series_requests.sql",
      "utf8",
    );
    expect(sql).toContain("recurring_series_requests");
    expect(sql).toContain("'open'");
    expect(sql).toContain("'acknowledged'");
    expect(sql).toContain("'resolved'");
  });

  it("group scope migration adds group_id and scope", async () => {
    const fs = await import("node:fs/promises");
    const sql = await fs.readFile(
      "supabase/migrations/20260608120000_recurring_series_requests_group_scope.sql",
      "utf8",
    );
    expect(sql).toContain("group_id");
    expect(sql).toContain("scope");
    expect(sql).toContain("pause_group");
  });

  it("group request route only calls customerRequestRecurringGroupChange", async () => {
    const fs = await import("node:fs/promises");
    const route = await fs.readFile(
      "src/app/api/customer/recurring/groups/[groupId]/request/route.ts",
      "utf8",
    );
    expect(route).toContain("customerRequestRecurringGroupChange");
    expect(route).not.toContain("pauseBookingSeries");
    expect(route).not.toContain("updateScheduleGroupStatus");
  });
});
