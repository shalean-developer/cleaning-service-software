import { describe, expect, it } from "vitest";
import {
  getWizardCardClass,
  getWizardNavClass,
  getWizardNavStickyClassName,
  getWizardShellClass,
  usesWideDesktopShell,
  usesWizardMobileStickyFooter,
  WIZARD_MAIN_COLUMN_CLASS,
  WIZARD_MOBILE_STICKY_NAV_OFFSET_REM,
  WIZARD_MOBILE_STICKY_SUMMARY_OFFSET_REM,
  WIZARD_STICKY_FOOTER_INNER_CLASS,
  WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS,
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

  it("marks service through checkout as wide desktop steps with mobile sticky footer", () => {
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
      expect(usesWizardMobileStickyFooter(step)).toBe(true);
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

  it("uses shared sticky nav className for mobile footer steps", () => {
    expect(getWizardNavStickyClassName()).toContain(WIZARD_MAIN_COLUMN_CLASS);
    expect(getWizardNavStickyClassName()).toContain("mt-0 md:mt-6");
  });

  it("reserves mobile padding from sticky footer height tokens", () => {
    expect(getWizardShellClass("datetime")).toContain(WIZARD_MOBILE_STICKY_NAV_OFFSET_REM);
    expect(getWizardShellClass("location")).toContain(WIZARD_MOBILE_STICKY_NAV_OFFSET_REM);
    expect(getWizardShellClass("details")).toContain(WIZARD_MOBILE_STICKY_NAV_OFFSET_REM);
    expect(getWizardShellClass("cleaner")).toContain(WIZARD_MOBILE_STICKY_NAV_OFFSET_REM);
    expect(getWizardShellClass("service")).toContain(WIZARD_MOBILE_STICKY_NAV_OFFSET_REM);
    expect(getWizardShellClass("review")).toContain(WIZARD_MOBILE_STICKY_SUMMARY_OFFSET_REM);
    expect(getWizardShellClass("checkout")).toContain(WIZARD_MOBILE_STICKY_SUMMARY_OFFSET_REM);
    expect(getWizardShellClass("review")).toContain("safe-area-inset-bottom");
    expect(getWizardShellClass("checkout")).toContain("safe-area-inset-bottom");
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

  it("exposes a shared summary slot class for sticky commerce rows", () => {
    expect(WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS).toContain("md:hidden");
    expect(WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS).toContain("mb-1.5");
  });
});
