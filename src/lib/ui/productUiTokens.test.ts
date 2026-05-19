import { describe, expect, it } from "vitest";
import {
  UI_BUTTON_PRIMARY_CLASS,
  UI_CARD_SHELL_CLASS,
  UI_DETAILS_DISCLOSURE_CLASS,
  UI_DETAILS_SUMMARY_CLASS,
  UI_FILTER_CHIP_NAV_CLASS,
  UI_INTERACTIVE_LIST_CARD_CLASS,
} from "./productUiTokens";

describe("productUiTokens", () => {
  it("uses rounded-2xl card shells consistently", () => {
    expect(UI_CARD_SHELL_CLASS).toContain("rounded-2xl");
    expect(UI_DETAILS_DISCLOSURE_CLASS).toContain("rounded-2xl");
    expect(UI_INTERACTIVE_LIST_CARD_CLASS).toContain("rounded-2xl");
  });

  it("standardizes touch-friendly primary buttons", () => {
    expect(UI_BUTTON_PRIMARY_CLASS).toContain("min-h-11");
    expect(UI_BUTTON_PRIMARY_CLASS).toContain("rounded-xl");
  });

  it("hides default details markers for custom summary rows", () => {
    expect(UI_DETAILS_SUMMARY_CLASS).toContain("[&::-webkit-details-marker]:hidden");
    expect(UI_DETAILS_SUMMARY_CLASS).toContain("min-h-11");
  });

  it("uses scroll-then-wrap filter chip nav from sm", () => {
    expect(UI_FILTER_CHIP_NAV_CLASS).toContain("overflow-x-auto");
    expect(UI_FILTER_CHIP_NAV_CLASS).toContain("sm:flex-wrap");
    expect(UI_FILTER_CHIP_NAV_CLASS).toContain("sm:overflow-visible");
  });
});
