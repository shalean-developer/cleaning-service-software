import { describe, expect, it } from "vitest";
import { buildMonthlyGovernanceTimeline } from "./buildMonthlyGovernanceTimeline";
import { computeOverrideExpiryInfo } from "./computeOverrideExpiryInfo";
import { assertAllowedBulkAction } from "./executeMonthlyGovernanceBulkAction";
import { buildMonthlyGovernanceCsv } from "./exportMonthlyGovernanceCsv";
import type { MonthlyGovernanceDashboard } from "./loadMonthlyGovernanceDashboard";

describe("computeOverrideExpiryInfo", () => {
  it("labels active overrides with days remaining", () => {
    const until = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const info = computeOverrideExpiryInfo(until);
    expect(info.state).toBe("expiring_soon");
    expect(info.label).toMatch(/Expires in 5 days/);
  });

  it("labels expired overrides", () => {
    const until = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const info = computeOverrideExpiryInfo(until);
    expect(info.state).toBe("expired");
    expect(info.label).toBe("Override expired");
  });
});

describe("buildMonthlyGovernanceTimeline", () => {
  it("merges audit entries and notes with admin names", () => {
    const timeline = buildMonthlyGovernanceTimeline({
      auditEntries: [
        {
          id: "a1",
          accountId: "acc",
          customerId: "cust",
          adminProfileId: "admin-1",
          action: "finance_review_started",
          previousState: "approved",
          nextState: "account_review_required",
          reason: "High exposure",
          exposureSnapshot: {},
          outstandingBalanceSnapshot: 10000,
          idempotencyKey: null,
          createdAt: "2026-05-20T10:00:00.000Z",
        },
      ],
      notes: [
        {
          id: "n1",
          customerId: "cust",
          batchId: null,
          adminProfileId: "admin-1",
          noteType: "governance_review",
          content: "Called customer",
          reviewOwnerAdminId: "admin-1",
          followUpDate: "2026-05-25",
          resolution: null,
          createdAt: "2026-05-19T09:00:00.000Z",
        },
      ],
      adminNamesById: { "admin-1": "Finance Admin" },
    });

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.title).toBe("Finance review started");
    expect(timeline[0]?.adminName).toBe("Finance Admin");
    expect(timeline[1]?.kind).toBe("finance_review");
  });
});

describe("executeMonthlyGovernanceBulkAction guards", () => {
  it("allows safe bulk actions only", () => {
    expect(assertAllowedBulkAction("mark_finance_review")).toBe(true);
    expect(assertAllowedBulkAction("add_note")).toBe(true);
    expect(assertAllowedBulkAction("assign_review_owner")).toBe(true);
  });

  it("rejects forbidden bulk automation actions", () => {
    expect(assertAllowedBulkAction("bulk_suspend")).toBe(false);
    expect(assertAllowedBulkAction("bulk_override")).toBe(false);
    expect(assertAllowedBulkAction("bulk_credit_limit")).toBe(false);
  });
});

describe("buildMonthlyGovernanceCsv", () => {
  it("includes governance export fields", () => {
    const dashboard = {
      customers: [
        {
          customerId: "cust-1",
          customerName: "Acme",
          governanceState: "approved",
          outstandingBalanceCents: 50000,
          exposure: {
            pendingExposureCents: 10000,
            exposurePercent: 60,
            exposureBand: "warning",
          },
          creditLimitCents: 100000,
          overdueInvoiceCount: 1,
          riskScore: 40,
          riskLevel: "medium",
          recommendation: "monitor",
          lastFinanceReviewAt: null,
          lastPaymentAt: null,
          overrideActive: false,
          manualOverrideUntil: null,
          overrideExpiryLabel: "No override",
          overrideExpiringSoon: false,
          financeReviewStatus: "open",
          financeReviewOwnerAdminId: "admin-1",
          financeReviewFollowUpDate: "2026-05-30",
          financeReviewResolution: null,
          notesCount: 2,
          lastActionAt: "2026-05-20T10:00:00.000Z",
        },
      ],
    } as unknown as MonthlyGovernanceDashboard;

    const csv = buildMonthlyGovernanceCsv(dashboard);
    expect(csv).toMatch(/customer_id,customer_name,governance_state/);
    expect(csv).toMatch(/cust-1/);
    expect(csv).toMatch(/notes_count/);
    expect(csv).toMatch(/review_owner_admin_id/);
  });
});
