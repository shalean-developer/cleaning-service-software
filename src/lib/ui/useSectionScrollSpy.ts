"use client";

import { useEffect, useState } from "react";

type Options<T extends string> = {
  sectionIds: readonly T[];
  idPrefix: string;
  /** IntersectionObserver rootMargin. biases which section counts as "in view". */
  rootMargin?: string;
};

/**
 * Lightweight scroll-spy via IntersectionObserver (no scroll listeners, no URL hashes).
 */
export function useSectionScrollSpy<T extends string>({
  sectionIds,
  idPrefix,
  rootMargin = "-15% 0px -55% 0px",
}: Options<T>): T | undefined {
  // Always undefined on first render so SSR and client hydration match.
  const [active, setActive] = useState<T | undefined>(undefined);

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
      if (best !== undefined) {
        setActive(best);
        return;
      }
      setActive((current) => current ?? sectionIds[0]);
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

    pickActive();

    return () => observer.disconnect();
  }, [sectionIds, idPrefix, rootMargin]);

  return active;
}
