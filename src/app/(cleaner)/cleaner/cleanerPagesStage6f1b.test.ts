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
    expect(source).toContain("Could not load offers");
    expect(source).toContain("No job offers right now");
    expect(source).toContain("New offers will appear here when jobs are available.");
    expect(source).not.toContain('result.ok ? result.offers : []');
    expect(source).not.toContain('title="No offers"');
  });

  it("jobs page shows fetch error before empty state", () => {
    const source = readPage("src/app/(cleaner)/cleaner/jobs/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain('!result.ok');
    expect(source).toContain("Could not load jobs");
    expect(source).toContain("No jobs yet");
    expect(source).toContain("Accepted jobs and active work will appear here.");
    expect(source).not.toContain("!result.ok || result.jobs.length === 0");
    expect(source).not.toContain('title="No assigned jobs"');
  });

  it("home page distinguishes fetch errors from empty previews", () => {
    const source = readPage("src/app/(cleaner)/cleaner/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain("offers && !offers.ok");
    expect(source).toContain("jobs && !jobs.ok");
    expect(source).toContain("Could not load offers");
    expect(source).toContain("Could not load jobs");
  });
});
