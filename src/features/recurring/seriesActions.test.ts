import { describe, expect, it } from "vitest";
import { resolveNextOccurrenceAfterNow } from "./seriesActions";

describe("resolveNextOccurrenceAfterNow", () => {
  it("advances weekly next when in the past", () => {
    const anchor = "2026-01-01T08:00:00+02:00";
    const pastNext = "2026-01-08T08:00:00+02:00";
    const now = new Date("2026-05-21T12:00:00+02:00");
    const next = resolveNextOccurrenceAfterNow("weekly", anchor, pastNext, now);
    expect(new Date(next).getTime()).toBeGreaterThan(now.getTime());
  });
});
