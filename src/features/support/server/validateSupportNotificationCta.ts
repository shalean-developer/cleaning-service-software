import { resolveNotificationAppBaseUrl } from "@/lib/app/appBaseUrl";

const ALLOWED_CTA_PREFIXES = [
  "/customer/bookings",
  "/admin/support",
] as const;

/** Relative same-origin paths only. rejects protocol-relative and external URLs. */
export function isValidSupportNotificationCtaPath(ctaPath: string): boolean {
  const trimmed = ctaPath.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  if (trimmed.includes("://") || trimmed.includes("\\")) return false;
  return ALLOWED_CTA_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/** Validates a fully built CTA URL against the configured app base. */
export function isValidSupportNotificationCtaUrl(ctaUrl: string): boolean {
  const trimmed = ctaUrl.trim();
  if (!trimmed) return false;

  try {
    const base = resolveNotificationAppBaseUrl().replace(/\/$/, "");
    const parsed = new URL(trimmed);
    const baseParsed = new URL(base);
    if (parsed.origin !== baseParsed.origin) return false;
    return isValidSupportNotificationCtaPath(parsed.pathname + parsed.search + parsed.hash);
  } catch {
    return false;
  }
}
