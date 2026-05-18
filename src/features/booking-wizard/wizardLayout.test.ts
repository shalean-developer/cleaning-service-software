import { describe, expect, it } from "vitest";
import {
  getWizardCardClass,
  getWizardNavClass,
  getWizardShellClass,
  usesWideDesktopShell,
  WIZARD_MAIN_COLUMN_CLASS,
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
      expect(shell).not.toContain("max-w-lg");
      expect(shell).not.toContain("md:max-w-3xl");
    }
  });

  it("keeps card and main column at full shell width", () => {
    expect(getWizardCardClass("datetime")).toContain("w-full");
    expect(WIZARD_MAIN_COLUMN_CLASS).toBe("w-full min-w-0");
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

  it("reserves extra mobile padding for commerce sticky steps", () => {
    expect(getWizardShellClass("details")).toContain("7.5rem");
    expect(getWizardShellClass("review")).toContain("10.75rem");
    expect(getWizardShellClass("checkout")).toContain("10.75rem");
    expect(getWizardShellClass("review")).toContain("safe-area-inset-bottom");
  });

  it("applies matching card padding for picker steps", () => {
    expect(getWizardCardClass("service")).toContain("p-3 md:p-6");
    expect(getWizardCardClass("datetime")).toContain("p-4 md:p-6");
    expect(getWizardCardClass("location")).toBe(
      "w-full rounded-2xl border border-zinc-200 bg-white shadow-sm p-4",
    );
  });
});
