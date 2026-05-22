import type { MarketingSectionId } from "./scrollToSection";
import {
  ABOUT_PAGE_PATH,
  CONTACT_PAGE_PATH,
  FAQ_PAGE_PATH,
  LOCATIONS_HUB_PATH,
  PRICING_PAGE_PATH,
  SERVICES_HUB_PATH,
} from "@/features/marketing/marketing-routes";

/** Canonical routes for section ids (in-page CTAs off homepage; main nav uses href directly). */
export const MARKETING_SECTION_ROUTES: Partial<Record<MarketingSectionId, string>> = {
  services: SERVICES_HUB_PATH,
  about: ABOUT_PAGE_PATH,
  areas: LOCATIONS_HUB_PATH,
  pricing: PRICING_PAGE_PATH,
  faq: FAQ_PAGE_PATH,
  contact: CONTACT_PAGE_PATH,
  "how-it-works": "/",
  "main-content": "/",
};

export function marketingSectionRoute(sectionId: MarketingSectionId): string {
  return MARKETING_SECTION_ROUTES[sectionId] ?? "/";
}
