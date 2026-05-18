import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardPageSkeleton } from "./DashboardPageSkeleton";

describe("DashboardPageSkeleton", () => {
  it("renders accessible loading state", () => {
    const html = renderToStaticMarkup(<DashboardPageSkeleton variant="list" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading…");
  });

  it("renders detail variant section blocks", () => {
    const html = renderToStaticMarkup(<DashboardPageSkeleton variant="detail" />);
    expect(html).toContain('role="status"');
    expect(html).toMatch(/rounded-2xl border border-zinc-200/);
  });
});
