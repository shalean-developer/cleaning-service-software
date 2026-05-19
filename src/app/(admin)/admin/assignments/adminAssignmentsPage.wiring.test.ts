import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin assignments page wiring (2C-3)", () => {
  it("prioritizes work queue before diagnostics", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/assignments/page.tsx"),
      "utf8",
    );

    const workbenchIndex = source.indexOf("<AdminAssignmentsQueueWorkbench");
    const bannerIndex = source.indexOf("<AdminCronHealthCriticalBanner");
    const diagnosticsDetailsIndex = source.indexOf("Diagnostics &amp; queue reference");
    const diagnosticsCronIndex = source.indexOf("embedded", diagnosticsDetailsIndex);

    expect(workbenchIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(diagnosticsDetailsIndex).toBeGreaterThan(workbenchIndex);
    expect(diagnosticsCronIndex).toBeGreaterThan(diagnosticsDetailsIndex);
    expect(source).toContain("AdminAssignmentsOperationsHeader");
  });
});
