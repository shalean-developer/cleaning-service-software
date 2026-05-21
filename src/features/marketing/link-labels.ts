import { MARKETING_SERVICES, SERVICE_SEO_PATHS } from "./constants";
import type { ServiceSlug } from "@/features/pricing/server/types";

/** Descriptive link label for a service SEO path (Lighthouse-friendly). */
export function serviceLinkLabelForPath(path: string): string {
  const entry = Object.entries(SERVICE_SEO_PATHS).find(([, p]) => p === path);
  if (!entry) return path.replace("/services/", "").replace(/-/g, " ");
  const slug = entry[0] as ServiceSlug;
  const card = MARKETING_SERVICES.find((s) => s.slug === slug);
  return card ? `${card.title} in Cape Town` : path;
}

export type ServiceLinkItem = { href: string; label: string };

export function serviceLinksFromPaths(paths: string[]): ServiceLinkItem[] {
  return paths.map((href) => ({ href, label: serviceLinkLabelForPath(href) }));
}
