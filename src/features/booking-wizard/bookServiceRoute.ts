import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { WIZARD_SERVICE_OPTIONS } from "./constants";

/** Validates a `/customer/book/:serviceSlug` segment for the booking wizard. */
export function resolveBookPageServiceSlug(param: string): ServiceSlug | null {
  if (!isServiceSlug(param)) return null;
  const option = WIZARD_SERVICE_OPTIONS.find((s) => s.slug === param);
  if (!option?.enabled) return null;
  return param;
}

export function customerBookServicePath(slug: ServiceSlug): string {
  return `/customer/book/${slug}`;
}

/** Path for `router.replace` when selecting a service, or null if the URL is already canonical. */
export function bookServiceReplacePath(
  currentPathname: string | null | undefined,
  slug: ServiceSlug,
): string | null {
  const target = customerBookServicePath(slug);
  return currentPathname === target ? null : target;
}

export type BookServiceUrlReplace = (
  path: string,
  options?: { scroll?: boolean },
) => void;

export function syncBookServiceUrlOnSelection(
  slug: ServiceSlug,
  pathname: string | null | undefined,
  replace: BookServiceUrlReplace,
): void {
  const path = bookServiceReplacePath(pathname, slug);
  if (path) replace(path, { scroll: false });
}
