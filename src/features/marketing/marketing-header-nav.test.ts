import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOOTER_QUICK_LINKS,
  HEADER_PRIMARY_NAV,
  HEADER_SECONDARY_NAV,
  HEADER_UTILITY_NAV,
  MARKETING_NAV_PATHS,
} from "./constants";

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("marketing header navigation", () => {
  it("primary nav uses canonical page hrefs, not section scroll", () => {
    const services = HEADER_PRIMARY_NAV.find((l) => l.label === "Services");
    const about = HEADER_PRIMARY_NAV.find((l) => l.label === "About");
    const locations = HEADER_PRIMARY_NAV.find((l) => l.label === "Locations");

    expect(services?.href).toBe("/services");
    expect(services?.sectionId).toBeUndefined();
    expect(about?.href).toBe("/about");
    expect(about?.sectionId).toBeUndefined();
    expect(locations?.href).toBe("/locations");
    expect(locations?.sectionId).toBeUndefined();
  });

  it("utility nav exposes FAQ and Contact on canonical pages", () => {
    const faq = HEADER_UTILITY_NAV.find((l) => l.label === "FAQ");
    const contact = HEADER_UTILITY_NAV.find((l) => l.label === "Contact");

    expect(faq?.href).toBe("/faq");
    expect(faq?.sectionId).toBeUndefined();
    expect(contact?.href).toBe("/contact");
    expect(contact?.sectionId).toBeUndefined();
    expect(HEADER_UTILITY_NAV.map((l) => l.label)).toEqual(["FAQ", "Contact"]);
  });

  it("secondary nav FAQ and Contact use canonical pages", () => {
    const faq = HEADER_SECONDARY_NAV.find((l) => l.label === "FAQ");
    const contact = HEADER_SECONDARY_NAV.find((l) => l.label === "Contact");

    expect(faq?.href).toBe("/faq");
    expect(faq?.sectionId).toBeUndefined();
    expect(contact?.href).toBe("/contact");
    expect(contact?.sectionId).toBeUndefined();
  });

  it("does not use Help as a marketing nav label", () => {
    const navLabels = [
      ...HEADER_UTILITY_NAV.map((l) => l.label),
      ...HEADER_SECONDARY_NAV.map((l) => l.label),
    ];
    expect(navLabels).not.toContain("Help");
  });

  it("marketing nav paths match required canonical URLs", () => {
    expect(MARKETING_NAV_PATHS.services).toBe("/services");
    expect(MARKETING_NAV_PATHS.about).toBe("/about");
    expect(MARKETING_NAV_PATHS.locations).toBe("/locations");
    expect(MARKETING_NAV_PATHS.pricing).toBe("/cleaning-prices-cape-town");
    expect(MARKETING_NAV_PATHS.faq).toBe("/faq");
    expect(MARKETING_NAV_PATHS.contact).toBe("/contact");
  });

  it("header component uses utility nav config and active states", () => {
    const source = readSource("src/components/marketing/MarketingHeader.tsx");
    expect(source).not.toContain('sectionId: "services"');
    expect(source).not.toContain('sectionId: "areas"');
    expect(source).toContain("HEADER_UTILITY_NAV");
    expect(source).toContain("showActiveState");
    expect(source).toContain("aria-current");
    expect(source).not.toMatch(/>\s*Help\s*</);
    expect(source).toContain("MarketingSectionOrRouteLink");
  });

  it("footer quick links use canonical routes for main sections", () => {
    const about = FOOTER_QUICK_LINKS.find((l) => l.label === "About Us");
    const pricing = FOOTER_QUICK_LINKS.find((l) => l.label === "Pricing");
    const locations = FOOTER_QUICK_LINKS.find((l) => l.label === "Locations");
    const faq = FOOTER_QUICK_LINKS.find((l) => l.label === "FAQ");
    const contact = FOOTER_QUICK_LINKS.find((l) => l.label === "Contact");

    expect(about?.sectionId).toBe("about");
    expect(pricing?.sectionId).toBe("pricing");
    expect(locations?.sectionId).toBe("areas");
    expect(faq?.sectionId).toBe("faq");
    expect(contact?.sectionId).toBe("contact");
  });

  it("footer maps quick links to canonical hrefs in component", () => {
    const source = readSource("src/components/marketing/sections/MarketingFooter.tsx");
    expect(source).toContain("ABOUT_PAGE_PATH");
    expect(source).toContain("PRICING_PAGE_PATH");
    expect(source).toContain('"/locations"');
    expect(source).toContain("FAQ_PAGE_PATH");
    expect(source).toContain('"/contact"');
  });

  it("section route fallbacks do not point main nav to homepage root", () => {
    const source = readSource("src/lib/ui/marketingSectionRoutes.ts");
    expect(source).toContain("services: SERVICES_HUB_PATH");
    expect(source).toContain("areas: LOCATIONS_HUB_PATH");
    expect(source).not.toMatch(/services:\s*["']\/["']/);
  });

  it("does not define a /help marketing route", () => {
    const marketingRoutes = readSource("src/features/marketing/marketing-routes.ts");
    expect(marketingRoutes).not.toContain("/help");
    const headerSource = readSource("src/components/marketing/MarketingHeader.tsx");
    expect(headerSource).not.toContain('"/help"');
  });
});
