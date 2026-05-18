import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerJobListCard } from "./CleanerJobListCard";

describe("CleanerJobListCard", () => {
  it("renders when, where, and pay hierarchy", () => {
    const html = renderToStaticMarkup(
      <CleanerJobListCard
        href="/cleaner/jobs/abc"
        serviceLabel="Regular Cleaning"
        scheduleLabel="Sat, 01 Jun, 10:00"
        locationSummary="Sea Point, Cape Town"
        earningsLabel="R 350,00"
        status="assigned"
      />,
    );

    expect(html).toContain("text-sky-800");
    expect(html).toContain("When");
    expect(html).toContain("Where");
    expect(html).toContain("Pay");
    expect(html).toContain("R 350,00");
  });
});
