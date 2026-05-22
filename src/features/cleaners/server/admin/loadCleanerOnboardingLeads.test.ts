import { describe, expect, it } from "vitest";
import {
  buildAdminCreateCleanerHref,
  loadCleanerOnboardingLeads,
} from "./loadCleanerOnboardingLeads";

describe("loadCleanerOnboardingLeads", () => {
  it("loads needs_auth_invite leads from report or csv when present", () => {
    const result = loadCleanerOnboardingLeads();
    if (!result.ok) {
      expect(result.code).toBe("files_missing");
      return;
    }

    expect(result.leads.length).toBeGreaterThan(0);
    expect(result.leads.every((l) => l.status === "needs_auth_invite")).toBe(true);
    expect(result.leads.some((l) => l.fullName === "Princess Saidi")).toBe(false);
  });

  it("builds create-cleaner URL with prefilled query params", () => {
    const href = buildAdminCreateCleanerHref({
      fullName: "Lorraine Moyo",
      phone: "+27680284159",
    });
    expect(href).toContain("/admin/cleaners/new?");
    expect(href).toContain("fullName=Lorraine");
    expect(href).toContain("phone=%2B27680284159");
  });
});
