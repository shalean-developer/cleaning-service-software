import { describe, expect, it } from "vitest";
import {
  parseAccountingCloseQueryParams,
  resolveAccountingClosePeriodBounds,
} from "./parseAccountingCloseQueryParams";

describe("parseAccountingCloseQueryParams", () => {
  it("defaults to monthly period", () => {
    const filters = parseAccountingCloseQueryParams(
      new URLSearchParams(),
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(filters.periodType).toBe("monthly");
    expect(filters.from).toBe("2026-07-01T00:00:00.000Z");
    expect(filters.to).toBe("2026-07-31T23:59:59.999Z");
  });

  it("resolves weekly period from anchor date", () => {
    const bounds = resolveAccountingClosePeriodBounds(
      "weekly",
      "2026-07-15",
      undefined,
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(bounds.periodStart).toBe("2026-07-13T00:00:00.000Z");
    expect(bounds.periodEnd).toBe("2026-07-19T23:59:59.999Z");
  });

  it("parses custom source filter", () => {
    const filters = parseAccountingCloseQueryParams(
      new URLSearchParams("periodType=custom&source=refund_credit&from=2026-07-01&to=2026-07-07"),
    );
    expect(filters.periodType).toBe("custom");
    expect(filters.source).toBe("refund_credit");
    expect(filters.from).toBe("2026-07-01");
    expect(filters.to).toBe("2026-07-07");
  });
});
