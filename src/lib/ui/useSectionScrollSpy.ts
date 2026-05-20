"use client";

import { useEffect, useState } from "react";

type Options<T extends string> = {
  sectionIds: readonly T[];
  idPrefix: string;
  /** IntersectionObserver rootMargin — biases which section counts as "in view". */
  rootMargin?: string;
};

/**
 * Lightweight scroll-spy via IntersectionObserver (no scroll listeners).
 * Preserves hash navigation; optional initial section from location hash.
 */
export function useSectionScrollSpy<T extends string>({
  sectionIds,
  idPrefix,
  rootMargin = "-15% 0px -55% 0px",
}: Options<T>): T | undefined {
  const [active, setActive] = useState<T | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash.startsWith(idPrefix)) {
      const suffix = hash.slice(idPrefix.length) as T;
      if (sectionIds.includes(suffix)) return suffix;
    }
    return sectionIds[0];
  });

  useEffect(() => {
    const ratios = new Map<T, number>();

    const pickActive = () => {
      let best: T | undefined;
      let bestRatio = 0;
      for (const id of sectionIds) {
        const ratio = ratios.get(id) ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          best = id;
        }
      }
      if (best !== undefined) setActive(best);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const suffix = el.id.slice(idPrefix.length) as T;
          if (!sectionIds.includes(suffix)) continue;
          ratios.set(suffix, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        pickActive();
      },
      { rootMargin, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    for (const id of sectionIds) {
      const el = document.getElementById(`${idPrefix}${id}`);
      if (el) observer.observe(el);
    }

    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash.startsWith(idPrefix)) return;
      const suffix = hash.slice(idPrefix.length) as T;
      if (sectionIds.includes(suffix)) setActive(suffix);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [sectionIds, idPrefix, rootMargin]);

  return active;
}
