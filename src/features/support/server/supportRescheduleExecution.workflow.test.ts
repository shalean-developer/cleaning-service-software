import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd());

describe("support reschedule execution workflow", () => {
  it("exposes execute-reschedule API route", () => {
    const route = readFileSync(
      join(
        root,
        "src/app/api/admin/booking-support-requests/[requestId]/execute-reschedule/route.ts",
      ),
      "utf8",
    );
    expect(route).toContain("executeApprovedBookingRescheduleRequest");
    expect(route).toContain("confirm");
  });

  it("registers RESCHEDULE_BOOKING command type", () => {
    const types = readFileSync(
      join(root, "src/features/bookings/server/commands/types.ts"),
      "utf8",
    );
    expect(types).toContain("RESCHEDULE_BOOKING");
    expect(types).toContain("ASSIGNMENT_UNAVAILABLE");
  });

  it("admin UI shows execute reschedule for reschedule requests", () => {
    const panel = readFileSync(
      join(root, "src/components/dashboard/admin/AdminBookingSupportRequestsPanel.tsx"),
      "utf8",
    );
    expect(panel).toContain("AdminSupportExecuteRescheduleForm");
    expect(panel).toContain('r.requestType === "reschedule"');
    const inbox = readFileSync(
      join(root, "src/components/dashboard/admin/support/AdminSupportInboxList.tsx"),
      "utf8",
    );
    expect(inbox).toContain("AdminSupportExecuteRescheduleForm");
    const form = readFileSync(
      join(root, "src/components/dashboard/admin/support/AdminSupportExecuteRescheduleForm.tsx"),
      "utf8",
    );
    expect(form).toContain("Execute reschedule");
    expect(form).toContain("Payment status will not change");
  });

  it("audit script checks reschedule execution consistency", () => {
    const script = readFileSync(join(root, "scripts/ops/audit-support-inbox.mjs"), "utf8");
    expect(script).toContain("RESCHEDULE_EXECUTION_METADATA_MISSING");
    expect(script).toContain("OPEN_OFFERS_AFTER_RESCHEDULE");
  });
});
