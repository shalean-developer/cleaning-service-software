import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardFetchError } from "./DashboardFetchError";
import { EmptyState } from "./EmptyState";

describe("DashboardFetchError", () => {
  it("uses alert role and is distinct from empty state", () => {
    const errorHtml = renderToStaticMarkup(
      <DashboardFetchError title="Could not load" description="Network error" />,
    );
    const emptyHtml = renderToStaticMarkup(
      <EmptyState title="No bookings yet" description="Book a clean to get started." />,
    );

    expect(errorHtml).toContain('role="alert"');
    expect(errorHtml).toContain("border-zinc-200");
    expect(errorHtml).toContain("bg-zinc-50/90");
    expect(emptyHtml).not.toContain('role="alert"');
    expect(emptyHtml).toContain("bg-white");
    expect(emptyHtml).not.toContain("bg-zinc-50/90");
  });
});
