import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("admin support inbox workflow contract", () => {
  it("support page uses read model only", () => {
    const page = readFileSync("src/app/(admin)/admin/support/page.tsx", "utf8");
    expect(page).toContain("listAdminSupportInbox");
    expect(page).not.toContain("booking_apply_transition");
    expect(page).not.toContain("adminUpdateBookingSupportRequestStatus");
  });

  it("inbox list calls status APIs without booking mutations", () => {
    const list = readFileSync(
      "src/components/dashboard/admin/support/AdminSupportInboxList.tsx",
      "utf8",
    );
    expect(list).toContain("/api/admin/booking-support-requests/");
    expect(list).toContain("/api/admin/recurring/requests/");
    expect(list).not.toContain('from("bookings")');
    expect(list).not.toContain("booking_finalize");
  });

  it("read model does not update bookings or series", () => {
    const source = readFileSync(
      "src/features/support/server/adminSupportInboxReadModel.ts",
      "utf8",
    );
    expect(source).not.toMatch(/\.update\(/);
    expect(source).not.toContain("booking_apply_transition");
  });

  it("package.json defines ops:audit:support-inbox", () => {
    const pkg = readFileSync("package.json", "utf8");
    expect(pkg).toContain('"ops:audit:support-inbox"');
  });

  it("audit script checks orphan and stale patterns", () => {
    const script = readFileSync("scripts/ops/audit-support-inbox.mjs", "utf8");
    expect(script).toContain("ORPHAN_BOOKING");
    expect(script).toContain("STALE_OPEN");
    expect(script).toContain("SLA_BREACHED");
    expect(script).toContain("ESCALATION_CANDIDATE");
    expect(script).toContain("booking_support_requests");
    expect(script).toContain("recurring_series_requests");
  });

  it("operations intelligence modules exist without booking mutations", () => {
    const sla = readFileSync("src/features/support/server/supportRequestSla.ts", "utf8");
    const ops = readFileSync(
      "src/features/support/server/supportOperationsReadModel.ts",
      "utf8",
    );
    expect(sla).toContain("supportRequestSlaStatus");
    expect(ops).toContain("buildSupportOperationsSnapshot");
    expect(ops).not.toContain("booking_apply_transition");
    expect(ops).not.toMatch(/\.update\(/);
  });

  it("admin nav includes support inbox", () => {
    const nav = readFileSync("src/features/dashboards/adminNav.ts", "utf8");
    expect(nav).toContain('"/admin/support"');
  });

  it("defines support notification feature flags default off", () => {
    const config = readFileSync(
      "src/features/support/server/supportNotificationConfig.ts",
      "utf8",
    );
    expect(config).toContain("ENABLE_SUPPORT_REQUEST_NOTIFICATIONS");
    expect(config).toContain("ENABLE_SUPPORT_ADMIN_ALERTS");
  });

  it("enqueue uses dedupe key in payload", () => {
    const types = readFileSync(
      "src/features/support/server/supportNotificationTypes.ts",
      "utf8",
    );
    expect(types).toContain("support_request:");
  });

  it("does not create public /help route", () => {
    const routes = readFileSync("src/features/marketing/marketing-routes.ts", "utf8");
    expect(routes).not.toContain("/help");
  });
});
