import { describe, expect, it } from "vitest";
import {
  parseTaxReportQueryParams,
  resolveTaxReportPeriodBounds,
} from "./parseTaxReportQueryParams";

describe("parseTaxReportQueryParams", () => {
  it("defaults to monthly period", () => {
    const filters = parseTaxReportQueryParams(
      new URLSearchParams(),
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(filters.periodType).toBe("monthly");
    expect(filters.from).toBe("2026-07-01T00:00:00.000Z");
    expect(filters.to).toBe("2026-07-31T23:59:59.999Z");
    expect(filters.includeUnresolved).toBe(false);
  });

  it("resolves quarterly period from anchor date", () => {
    const bounds = resolveTaxReportPeriodBounds(
      "quarterly",
      "2026-07-15",
      undefined,
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(bounds.periodStart).toBe("2026-07-01T00:00:00.000Z");
    expect(bounds.periodEnd).toBe("2026-09-30T23:59:59.999Z");
  });

  it("parses includeUnresolved=true", () => {
    const filters = parseTaxReportQueryParams(
      new URLSearchParams("periodType=custom&includeUnresolved=true"),
    );
    expect(filters.includeUnresolved).toBe(true);
  });
});
