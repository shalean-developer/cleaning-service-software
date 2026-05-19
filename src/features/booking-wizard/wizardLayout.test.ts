import { describe, expect, it } from "vitest";
import {
  getWizardCardClass,
  getWizardNavClass,
  getWizardShellClass,
  usesWideDesktopShell,
  WIZARD_MAIN_COLUMN_CLASS,
  WIZARD_STICKY_FOOTER_INNER_CLASS,
} from "./wizardLayout";

describe("wizardLayout", () => {
  it("uses the same max-w-3xl shell for service through checkout", () => {
    for (const step of [
      "service",
      "datetime",
      "location",
      "details",
      "cleaner",
      "review",
      "checkout",
    ] as const) {
      const shell = getWizardShellClass(step);
      expect(shell).toContain("max-w-3xl");
      expect(shell).toContain("w-full");
      expect(shell).toContain("overflow-x-clip");
      expect(shell).not.toContain("max-w-lg");
      expect(shell).not.toContain("md:max-w-3xl");
    }
  });

  it("keeps card and main column at full shell width", () => {
    expect(getWizardCardClass("datetime")).toContain("w-full");
    expect(WIZARD_MAIN_COLUMN_CLASS).toBe("w-full min-w-0");
    expect(WIZARD_STICKY_FOOTER_INNER_CLASS).toContain("max-w-3xl");
  });

  it("marks service through checkout as wide desktop steps", () => {
    for (const step of [
      "service",
      "datetime",
      "location",
      "details",
      "cleaner",
      "review",
      "checkout",
    ] as const) {
      expect(usesWideDesktopShell(step)).toBe(true);
    }
  });

  it("aligns datetime through review nav spacing with service on desktop", () => {
    expect(getWizardNavClass("datetime")).toBe("mt-8 md:mt-6");
    expect(getWizardNavClass("location")).toBe("mt-8 md:mt-6");
    expect(getWizardNavClass("details")).toBe("mt-8 md:mt-6");
    expect(getWizardNavClass("cleaner")).toBe("mt-8 md:mt-6");
    expect(getWizardNavClass("review")).toBe("mt-8 md:mt-6");
    expect(getWizardNavClass("checkout")).toBe("mt-8 md:mt-6");
    expect(getWizardNavClass("service")).toBeUndefined();
  });

  it("reserves extra mobile padding for sticky nav steps", () => {
    expect(getWizardShellClass("datetime")).toContain("7.5rem");
    expect(getWizardShellClass("location")).toContain("7.5rem");
    expect(getWizardShellClass("details")).toContain("7.5rem");
    expect(getWizardShellClass("cleaner")).toContain("7.5rem");
    expect(getWizardShellClass("review")).toContain("10.75rem");
    expect(getWizardShellClass("checkout")).toContain("7.5rem");
    expect(getWizardShellClass("review")).toContain("safe-area-inset-bottom");
  });

  it("applies consistent card padding across picker steps", () => {
    for (const step of [
      "service",
      "datetime",
      "location",
      "details",
      "cleaner",
      "review",
      "checkout",
    ] as const) {
      expect(getWizardCardClass(step)).toContain("p-4 md:p-6");
    }
  });
});
