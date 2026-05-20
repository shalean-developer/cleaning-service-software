/** Homepage section element ids used for in-page scroll (no URL hashes). */
export type MarketingSectionId =
  | "services"
  | "about"
  | "areas"
  | "pricing"
  | "faq"
  | "contact"
  | "how-it-works"
  | "main-content";

const MARKETING_SECTION_IDS = new Set<string>([
  "services",
  "about",
  "areas",
  "pricing",
  "faq",
  "contact",
  "how-it-works",
  "main-content",
]);

export function isMarketingSectionId(id: string): id is MarketingSectionId {
  return MARKETING_SECTION_IDS.has(id);
}

function readHeaderOffsetPx(): number {
  if (typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--marketing-header-height",
  );
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 76;
}

/**
 * Smooth-scroll to a homepage section without updating the URL hash.
 * Returns true when the target element exists.
 */
export function scrollToSection(
  sectionId: MarketingSectionId,
  options?: { behavior?: ScrollBehavior; focus?: boolean },
): boolean {
  if (typeof document === "undefined") return false;

  const el = document.getElementById(sectionId);
  if (!el) return false;

  const headerOffset = readHeaderOffsetPx();
  const top =
    el.getBoundingClientRect().top + window.scrollY - headerOffset - 8;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: options?.behavior ?? "smooth",
  });

  if (options?.focus !== false && sectionId === "main-content") {
    el.focus({ preventScroll: true });
  }

  return true;
}

/** Strip hash from the URL after handling legacy bookmarked links. */
export function clearUrlHash(): void {
  if (typeof window === "undefined" || !window.location.hash) return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

/**
 * If the URL contains a legacy section hash, scroll to it and remove the hash.
 */
export function handleLegacySectionHash(): void {
  if (typeof window === "undefined") return;
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw || !isMarketingSectionId(raw)) return;
  requestAnimationFrame(() => {
    scrollToSection(raw, { behavior: "smooth" });
    clearUrlHash();
  });
}
