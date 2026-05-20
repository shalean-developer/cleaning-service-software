/** Production marketing origin when env is unset (sitemap, JSON-LD fallbacks). */
export const DEFAULT_MARKETING_SITE_URL = "https://shalean.co.za";

/** Canonical public site origin for sitemap and absolute marketing URLs. */
export function getMarketingSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return DEFAULT_MARKETING_SITE_URL;
}
