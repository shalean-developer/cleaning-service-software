import { describe, expect, it } from "vitest";
import { parseServiceAreasInput } from "@/features/cleaners/admin/cleanerProfileFormValidation";
import { formatServiceAreaSlugsForInput } from "@/features/cleaners/admin/cleanerProfileEditValidation";
import { getCleanerAreaOptionGroups, resolveAreaSlug } from "./locationRegistry";

describe("cleaner admin area picker data", () => {
  it("renders region groups from registry", () => {
    const groups = getCleanerAreaOptionGroups();
    expect(groups.length).toBeGreaterThan(5);
    expect(groups.some((g) => g.region === "Atlantic Seaboard")).toBe(true);
    expect(groups.some((g) => g.region === "Southern Suburbs")).toBe(true);
  });

  it("saves normalized slugs and displays legacy strings", () => {
    const slugs = parseServiceAreasInput("Sea Point\nTableview\nlegacy-area");
    expect(slugs).toContain("sea-point");
    expect(slugs).toContain("table-view");
    expect(formatServiceAreaSlugsForInput(slugs)).toContain("Sea Point");
    expect(formatServiceAreaSlugsForInput(slugs)).toContain("Table View");
  });
});

describe("apply form area selection", () => {
  it("preferred area labels map to registry slugs on submit path", () => {
    expect(resolveAreaSlug("Sea Point")).toBe("sea-point");
    expect(resolveAreaSlug("Claremont")).toBe("claremont");
  });
});
