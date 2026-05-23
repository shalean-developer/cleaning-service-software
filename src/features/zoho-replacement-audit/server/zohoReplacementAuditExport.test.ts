import { describe, expect, it } from "vitest";
import { zohoReplacementAuditToCsv, zohoReplacementAuditToJson } from "./zohoReplacementAuditExport";
import { buildZohoReplacementAudit } from "./zohoReplacementAuditReadModel";

describe("zohoReplacementAuditExport", () => {
  it("exports safe CSV without secrets", () => {
    const audit = buildZohoReplacementAudit(true);
    const csv = zohoReplacementAuditToCsv(audit);
    expect(csv).toContain("capability_matrix");
    expect(csv).toContain("missing_capabilities");
    expect(csv).toContain("migration_risks");
    expect(csv).toContain("migration_phases");
    expect(csv).toContain("immutable_ledger");
    expect(csv).not.toContain("authorization_code");
    expect(csv).not.toContain("refresh_token");
    expect(csv).not.toContain("sk_live_");
  });

  it("exports safe JSON audit payload", () => {
    const audit = buildZohoReplacementAudit(true);
    const json = zohoReplacementAuditToJson(audit);
    expect(json).toContain('"overallReadinessScore"');
    expect(json).not.toContain("refresh_token");
    expect(json).not.toContain("client_secret");
  });
});
