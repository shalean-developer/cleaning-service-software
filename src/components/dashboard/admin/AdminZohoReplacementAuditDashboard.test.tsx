import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildZohoReplacementAudit } from "@/features/zoho-replacement-audit/server/zohoReplacementAuditReadModel";
import { AdminZohoReplacementAuditDashboard } from "./AdminZohoReplacementAuditDashboard";

describe("AdminZohoReplacementAuditDashboard", () => {
  it("renders audit sections, export links, and no mutation actions", () => {
    const audit = buildZohoReplacementAudit(true);
    const html = renderToStaticMarkup(<AdminZohoReplacementAuditDashboard audit={audit} />);

    expect(html).toContain("Executive summary");
    expect(html).toContain("Current Zoho dependencies");
    expect(html).toContain("Shalean-native capabilities");
    expect(html).toContain("Capability matrix");
    expect(html).toContain("Missing accounting capabilities");
    expect(html).toContain("Risk assessment");
    expect(html).toContain("Suggested phased migration plan");
    expect(html).toContain("Recommended architecture");
    expect(html).toContain("reviewed with an accountant");
    expect(html).toContain("Download CSV");
    expect(html).toContain("Download JSON");
    expect(html).toContain("Download Markdown report");
    expect(html).not.toContain("Mark paid");
    expect(html).not.toContain("Charge saved card");
    expect(html).not.toContain("authorization_code");
    expect(html).not.toContain("refresh_token");
  });
});
