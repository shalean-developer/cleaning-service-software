import { describe, expect, it } from "vitest";
import { parsePaymentReturnServiceSlug } from "./customerDisplayServiceSlug";

describe("parsePaymentReturnServiceSlug", () => {
  it("parses all catalog service slugs including regular cleaning", () => {
    expect(parsePaymentReturnServiceSlug("regular-cleaning")).toBe("regular-cleaning");
    expect(parsePaymentReturnServiceSlug("airbnb-cleaning")).toBe("airbnb-cleaning");
    expect(parsePaymentReturnServiceSlug("moving-cleaning")).toBe("moving-cleaning");
    expect(parsePaymentReturnServiceSlug("unknown")).toBeNull();
    expect(parsePaymentReturnServiceSlug(null)).toBeNull();
  });
});
