import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("OfferActions", () => {
  it("opens decline confirmation instead of posting immediately", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/OfferActions.tsx"),
      "utf8",
    );

    expect(source).toContain("DeclineOfferConfirmSheet");
    expect(source).toContain("openDeclineConfirm");
    expect(source).toContain('onClick={openDeclineConfirm}');
    expect(source).not.toMatch(/onClick=\{\(\) => respond\("decline"\)\}/);
    expect(source).toContain('onConfirm={() => respond("decline")}');
    expect(source).toContain('onClick={() => respond("accept")}');
    expect(source).toContain("/api/cleaner/offers/${offerId}/${action}");
  });

  it("uses stacked full-width mobile action classes", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/OfferActions.tsx"),
      "utf8",
    );

    expect(source).toContain("flex-col");
    expect(source).toContain("gap-3");
    expect(source).toContain("min-h-11");
    expect(source).toContain("w-full");
    expect(source).toContain("md:flex-row");
  });
});
