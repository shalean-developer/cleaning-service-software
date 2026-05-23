import { describe, expect, it } from "vitest";
import { FINANCE_RECONCILIATION_ISSUE_CODES } from "./financeReconciliationIssueCodes";

describe("financeReconciliationIssueCodes", () => {
  it("maps issue codes with labels and action hints", () => {
    expect(FINANCE_RECONCILIATION_ISSUE_CODES.MATCHED.label).toBe("Matched");
    expect(FINANCE_RECONCILIATION_ISSUE_CODES.MISSING_ZOHO_SYNC.actionHint).toContain(
      "zoho-sales-sync",
    );
    expect(FINANCE_RECONCILIATION_ISSUE_CODES.CREDIT_NOTE_FAILED.severity).toBe("error");
  });
});
