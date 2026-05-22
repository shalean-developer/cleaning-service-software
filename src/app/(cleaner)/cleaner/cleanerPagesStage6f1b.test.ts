import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("cleaner pages Stage 6F-1b empty/error wiring", () => {
  it("offers page shows fetch error before empty state", () => {
    const source = readPage("src/app/(cleaner)/cleaner/offers/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain('!result.ok');
    expect(source).toContain('dashboardFetchErrorTitle("offers", "cleaner")');
    expect(source).toContain("No offers right now");
    expect(source).toContain("Matching jobs in your area will show up here");
    expect(source).not.toContain('result.ok ? result.offers : []');
    expect(source).not.toContain('title="No offers"');
  });

  it("jobs page shows fetch error before empty state", () => {
    const source = readPage("src/app/(cleaner)/cleaner/jobs/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain('!result.ok');
    expect(source).toContain('dashboardFetchErrorTitle("jobs", "cleaner")');
    expect(source).toContain("No jobs yet");
    expect(source).toContain("Accepted offers appear here with your schedule and pay");
    expect(source).not.toContain("!result.ok || result.jobs.length === 0");
    expect(source).not.toContain('title="No assigned jobs"');
  });

  it("home page distinguishes fetch errors from empty previews without duplicate summary hints", () => {
    const source = readPage("src/app/(cleaner)/cleaner/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain("offers && !offers.ok");
    expect(source).toContain("jobs && !jobs.ok");
    expect(source).toContain("dashboardFetchErrorTitle(\"offers\", \"cleaner\")");
    expect(source).toContain("dashboardFetchErrorTitle(\"jobs\", \"cleaner\")");
    expect(source).toContain('offersOk ? openOffers.length : "-"');
    expect(source).toContain('jobsOk ? activeJobs.length : "-"');
    expect(source).not.toContain('text-xs text-red-700">Could not load offers');
    expect(source).not.toContain('text-xs text-red-700">Could not load jobs');
    expect(source).toContain("openOffers.slice(0, 3)");
    expect(source).toContain("activeJobs.slice(0, 3)");
  });
});
