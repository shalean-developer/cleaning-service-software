import { describe, expect, it } from "vitest";
import { testCleanerJobDetail } from "@/test/fixtures";
import type { CleanerJobDetail } from "./types";

/** NF-3: cleaner surfaces must not expose customer contact phone. */
describe("cleaner job phone visibility policy", () => {
  it("CleanerJobDetail type has no customer phone fields", () => {
    const sample = testCleanerJobDetail({ bookingId: "b1" }) satisfies CleanerJobDetail;

    const keys = Object.keys(sample);
    expect(keys.some((k) => /phone|contact/i.test(k))).toBe(false);
  });
});
