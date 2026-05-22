import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin assignments page wiring (orchestration)", () => {
  it("renders dispatch orchestration before diagnostics", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/assignments/page.tsx"),
      "utf8",
    );

    const orchestrationIndex = source.indexOf("<AdminDispatchOrchestration");
    const bannerIndex = source.indexOf("<AdminCronHealthCriticalBanner");
    const diagnosticsDetailsIndex = source.indexOf("Diagnostics &amp; queue reference");
    const diagnosticsCronIndex = source.indexOf("embedded", diagnosticsDetailsIndex);

    expect(orchestrationIndex).toBeGreaterThan(-1);
    expect(bannerIndex).toBeGreaterThan(-1);
    expect(diagnosticsDetailsIndex).toBeGreaterThan(orchestrationIndex);
    expect(diagnosticsCronIndex).toBeGreaterThan(diagnosticsDetailsIndex);
    expect(source).toContain("loadAdminDispatchOrchestration");
  });
});
