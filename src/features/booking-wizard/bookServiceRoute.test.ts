import { describe, expect, it } from "vitest";
import {
  customerBookServicePath,
  resolveBookPageServiceSlug,
} from "./bookServiceRoute";

describe("resolveBookPageServiceSlug", () => {
  it("accepts regular-cleaning", () => {
    expect(resolveBookPageServiceSlug("regular-cleaning")).toBe("regular-cleaning");
  });

  it("accepts other enabled catalog slugs", () => {
    expect(resolveBookPageServiceSlug("office-cleaning")).toBe("office-cleaning");
    expect(resolveBookPageServiceSlug("deep-cleaning")).toBe("deep-cleaning");
  });

  it("rejects unknown and malformed slugs", () => {
    expect(resolveBookPageServiceSlug("regular_cleaning")).toBeNull();
    expect(resolveBookPageServiceSlug("unknown-service")).toBeNull();
    expect(resolveBookPageServiceSlug("")).toBeNull();
    expect(resolveBookPageServiceSlug("Regular-Cleaning")).toBeNull();
  });
});

describe("customerBookServicePath", () => {
  it("builds the customer book service URL", () => {
    expect(customerBookServicePath("regular-cleaning")).toBe(
      "/customer/book/regular-cleaning",
    );
  });
});
