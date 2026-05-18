import { describe, expect, it } from "vitest";
import { formatAddonPrice } from "./format";

describe("formatAddonPrice", () => {
  it("formats cents as a compact + R whole-number label", () => {
    expect(formatAddonPrice(16_000)).toBe("+ R 160");
    expect(formatAddonPrice(12_000)).toBe("+ R 120");
  });
});
