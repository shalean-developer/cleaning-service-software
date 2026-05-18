import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("cleaner home page (7P-1D)", () => {
  it("shows one DashboardFetchError per failed resource, not inline summary errors", () => {
    const source = readPage("src/app/(cleaner)/cleaner/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain('title="Could not load offers"');
    expect(source).toContain('title="Could not load jobs"');
    expect(source).toContain("description={offers.message}");
    expect(source).toContain("description={jobs.message}");
    expect(source).not.toContain('text-xs text-red-700">Could not load offers');
    expect(source).not.toContain('text-xs text-red-700">Could not load jobs');
  });

  it("preserves partial success rendering for offers and jobs previews", () => {
    const source = readPage("src/app/(cleaner)/cleaner/page.tsx");

    expect(source).toContain("const offersOk = offers?.ok === true");
    expect(source).toContain("const jobsOk = jobs?.ok === true");
    const offersErrorIndex = source.indexOf("offers && !offers.ok");
    const offersFetchErrorIndex = source.indexOf('title="Could not load offers"');
    const offersPreviewIndex = source.indexOf("openOffers.length > 0");
    const jobsErrorIndex = source.indexOf("jobs && !jobs.ok");
    const jobsFetchErrorIndex = source.indexOf('title="Could not load jobs"');
    const jobsPreviewIndex = source.indexOf("activeJobs.length > 0");

    expect(offersErrorIndex).toBeGreaterThan(-1);
    expect(offersFetchErrorIndex).toBeGreaterThan(offersErrorIndex);
    expect(offersPreviewIndex).toBeGreaterThan(offersFetchErrorIndex);
    expect(jobsErrorIndex).toBeGreaterThan(-1);
    expect(jobsFetchErrorIndex).toBeGreaterThan(jobsErrorIndex);
    expect(jobsPreviewIndex).toBeGreaterThan(jobsFetchErrorIndex);
  });
});
