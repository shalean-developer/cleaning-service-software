"use client";

import type { MarketingSectionId } from "@/lib/ui/scrollToSection";
import { scrollToSection } from "@/lib/ui/scrollToSection";

export function MarketingSkipLink() {
  const sectionId: MarketingSectionId = "main-content";

  return (
    <button
      type="button"
      className="sr-only"
      onClick={() => scrollToSection(sectionId)}
    >
      Skip to main content
    </button>
  );
}
