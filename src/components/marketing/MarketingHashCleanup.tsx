"use client";

import { useEffect } from "react";
import { handleLegacySectionHash } from "@/lib/ui/scrollToSection";

/** Removes legacy `#section` URLs after scrolling; does not add hashes on navigation. */
export function MarketingHashCleanup() {
  useEffect(() => {
    handleLegacySectionHash();
  }, []);

  return null;
}
