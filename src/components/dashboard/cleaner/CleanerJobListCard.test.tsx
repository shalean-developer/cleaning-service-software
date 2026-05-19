import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerJobListCard } from "./CleanerJobListCard";

describe("CleanerJobListCard", () => {
  it("renders compact service, schedule, location, and pay hierarchy", () => {
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
    expect(html).toContain("Regular Cleaning");
    expect(html).toContain("Sat, 01 Jun, 10:00");
    expect(html).toContain("Sea Point, Cape Town");
    expect(html).toContain("R 350,00");
    expect(html).toContain("line-clamp-2");
    expect(html).toContain("[overflow-wrap:anywhere]");
  });
});
