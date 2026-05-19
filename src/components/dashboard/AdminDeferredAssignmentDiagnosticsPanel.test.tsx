import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminDeferredAssignmentDiagnosticsPanel } from "./AdminDeferredAssignmentDiagnosticsPanel";

describe("AdminDeferredAssignmentDiagnosticsPanel", () => {
  it("renders overdue count in embedded mode", () => {
    const html = renderToStaticMarkup(
      <AdminDeferredAssignmentDiagnosticsPanel
        embedded
        diagnostics={{
          deferredAssignmentEnabled: true,
          awaitingDispatchWindowCount: 3,
          readyForDispatchCount: 1,
          overdueDispatchCount: 2,
          oldestOverdueDispatchAt: "2026-01-01T08:00:00Z",
          lastCronRun: null,
        }}
      />,
    );
    expect(html).toContain("Overdue dispatch");
    expect(html).toContain("2");
    expect(html).not.toContain("<h2");
  });
});
