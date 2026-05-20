"use client";

import type { MarketingSectionId } from "@/lib/ui/scrollToSection";
import { scrollToSection } from "@/lib/ui/scrollToSection";

export function MarketingSkipLink() {
  const sectionId: MarketingSectionId = "main-content";

  return (
    <button
      type="button"
      className="skip-to-main marketing-focus-ring"
      onClick={() => scrollToSection(sectionId)}
    >
      Skip to main content
    </button>
  );
}
