import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerEarningsSummaryCards } from "./CleanerEarningsSummaryCards";

describe("CleanerEarningsSummaryCards", () => {
  it("renders completed jobs and total earnings with helpers", () => {
    const html = renderToStaticMarkup(
      <CleanerEarningsSummaryCards completedJobCount={24} totalEarningsCents={1_245_000} />,
    );

    expect(html).toContain("Completed jobs");
    expect(html).toContain("24");
    expect(html).toContain("Total earnings");
    expect(html).toContain("R");
    expect(html).toContain("Completed cleaning services");
    expect(html).toContain("Across completed payouts");
  });

  it("shows zero state values", () => {
    const html = renderToStaticMarkup(
      <CleanerEarningsSummaryCards completedJobCount={0} totalEarningsCents={0} />,
    );

    expect(html).toContain(">0<");
    expect(html).toContain("R");
  });
});
