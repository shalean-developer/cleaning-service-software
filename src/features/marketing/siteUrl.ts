/** Production marketing origin for sitemap, canonicals, and JSON-LD. */
export const DEFAULT_MARKETING_SITE_URL = "https://shalean.co.za";

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.0\.0\.1$/,
  /^\[::1\]$/,
  /\.vercel\.app$/i,
  /^www\.shalean\.co\.za$/i,
];

function normalizeOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Canonical public site origin for SEO outputs (sitemap, metadata, JSON-LD).
 * Never returns localhost, Vercel preview hosts, or www. falls back to shalean.co.za.
 */
export function getMarketingSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_MARKETING_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const origin = normalizeOrigin(raw.trim().replace(/\/$/, ""));
    if (origin) return origin;
  }

  return DEFAULT_MARKETING_SITE_URL;
}

/** Absolute marketing URL for a path (always uses canonical origin). */
export function getMarketingCanonicalUrl(path: string): string {
  const base = getMarketingSiteUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized === "/" ? "" : normalized}`;
}
