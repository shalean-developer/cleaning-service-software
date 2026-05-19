import { describe, expect, it, vi } from "vitest";
import type { ServiceSlug } from "@/features/pricing/server/types";
import {
  bookServiceReplacePath,
  customerBookServicePath,
  resolveBookPageServiceSlug,
  syncBookServiceUrlOnSelection,
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

  const canonicalPaths: [ServiceSlug, string][] = [
    ["regular-cleaning", "/customer/book/regular-cleaning"],
    ["deep-cleaning", "/customer/book/deep-cleaning"],
    ["moving-cleaning", "/customer/book/moving-cleaning"],
    ["airbnb-cleaning", "/customer/book/airbnb-cleaning"],
    ["office-cleaning", "/customer/book/office-cleaning"],
    ["carpet-cleaning", "/customer/book/carpet-cleaning"],
  ];

  it.each(canonicalPaths)("maps %s to its canonical book path", (slug, path) => {
    expect(customerBookServicePath(slug)).toBe(path);
  });
});

describe("bookServiceReplacePath", () => {
  it("returns canonical path when current path is generic book route", () => {
    expect(bookServiceReplacePath("/customer/book", "deep-cleaning")).toBe(
      "/customer/book/deep-cleaning",
    );
  });

  it("returns canonical path when switching between service routes", () => {
    expect(
      bookServiceReplacePath("/customer/book/regular-cleaning", "deep-cleaning"),
    ).toBe("/customer/book/deep-cleaning");
  });

  it("returns null when already on the canonical path", () => {
    expect(
      bookServiceReplacePath("/customer/book/deep-cleaning", "deep-cleaning"),
    ).toBeNull();
  });
});

describe("syncBookServiceUrlOnSelection", () => {
  it("calls replace with the canonical path when the URL should change", () => {
    const replace = vi.fn();
    syncBookServiceUrlOnSelection("moving-cleaning", "/customer/book", replace);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/customer/book/moving-cleaning");
  });

  it("does not call replace when the URL is already canonical", () => {
    const replace = vi.fn();
    syncBookServiceUrlOnSelection(
      "airbnb-cleaning",
      "/customer/book/airbnb-cleaning",
      replace,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
