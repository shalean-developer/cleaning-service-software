import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_IMPORT_PATTERNS = [
  /finalizePaidBooking/,
  /executeBookingCommand/,
  /runPostPaymentAssignmentDispatch/,
  /from "@\/lib\/zoho\/customerPayments"/,
  /from "@\/features\/payments/,
  /auto.?suspend/i,
  /autoSuspend/i,
  /blockAssignment/i,
  /auto.?void/i,
  /write.?off/i,
  /auto.?cancel/i,
];

const MONTHLY_BILLING_ROOT = path.join(process.cwd(), "src/features/monthly-billing");

function collectSourceFiles(dir: string): string[] {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...collectSourceFiles(full));
    else if (
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

describe("monthly billing phase 9 safety guards", () => {
  it("does not import forbidden lifecycle, payout, or auto-enforcement modules", () => {
    const files = collectSourceFiles(MONTHLY_BILLING_ROOT);
    for (const file of files) {
      const relative = path.relative(MONTHLY_BILLING_ROOT, file).replace(/\\/g, "/");
      const content = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(content, `${relative} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("migration adds governance columns and audit table", () => {
    const migration = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260718100000_zoho_monthly_account_billing_phase9_credit_governance.sql",
      ),
      "utf8",
    );
    expect(migration).toMatch(/governance_state/);
    expect(migration).toMatch(/customer_billing_account_governance_audit/);
    expect(migration).toMatch(/credit_limit_cents/);
    expect(migration).toMatch(/manual_override_until/);
  });

  it("phase 10 migration adds finance review workflow fields only", () => {
    const migration = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260719100000_zoho_monthly_account_billing_phase10_governance_workflow_polish.sql",
      ),
      "utf8",
    );
    expect(migration).toMatch(/finance_review_status/);
    expect(migration).toMatch(/finance_review_owner_admin_id/);
    expect(migration).toMatch(/finance_review_follow_up_date/);
    expect(migration).not.toMatch(/auto_suspend/i);
  });

  it("authorization gate only blocks suspended accounts in monthly-billing module", () => {
    const gate = readFileSync(
      path.join(MONTHLY_BILLING_ROOT, "server/assertMonthlyAccountServiceAuthorizationAllowed.ts"),
      "utf8",
    );
    expect(gate).toMatch(/governanceState === "suspended"/);
    expect(gate).not.toMatch(/return fail\([\s\S]*finance_hold/);
  });

  it("customer portal read model does not expose governance internals", () => {
    const readModel = readFileSync(
      path.join(MONTHLY_BILLING_ROOT, "server/customerMonthlyInvoicesReadModel.ts"),
      "utf8",
    );
    expect(readModel).not.toMatch(/governanceState/);
    expect(readModel).not.toMatch(/riskScore/);
    expect(readModel).not.toMatch(/suspensionReason/);
  });

  it("governance dashboard UI exposes override and suspension sections", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyGovernanceDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/Suspend/);
    expect(dashboard).toMatch(/monthly-governance-override-badge/);
    expect(dashboard).toMatch(/monthly-governance-bulk-actions/);
    expect(dashboard).not.toMatch(/bulk_suspend/);
  });

  it("authorize service panel shows governance warnings", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminBookingAuthorizeServicePanel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/admin-booking-authorize-service-governance-warnings/);
    expect(panel).toMatch(/admin-booking-authorize-service-suspended/);
    expect(panel).toMatch(/admin-booking-authorize-service-elevated-confirm/);
  });
});

describe("monthly billing phase 9 authorize facade enforcement boundary", () => {
  it("authorize facade imports suspension gate but not payout modules", () => {
    const facade = readFileSync(
      path.join(process.cwd(), "src/features/bookings/server/admin/authorizeMonthlyAccountServiceFacade.ts"),
      "utf8",
    );
    expect(facade).toMatch(/ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION/);
    expect(facade).not.toMatch(/finalizePaidBooking/);
    expect(facade).not.toMatch(/runPostPaymentAssignmentDispatch/);
  });
});
