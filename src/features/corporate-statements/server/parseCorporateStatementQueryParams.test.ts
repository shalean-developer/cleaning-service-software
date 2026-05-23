import { describe, expect, it } from "vitest";
import {
  CorporateStatementValidationError,
  parseCorporateStatementQueryParams,
} from "./parseCorporateStatementQueryParams";

describe("parseCorporateStatementQueryParams", () => {
  it("rejects missing customer identifier", () => {
    expect(() => parseCorporateStatementQueryParams(new URLSearchParams())).toThrow(
      CorporateStatementValidationError,
    );
  });

  it("parses customer email and monthly period", () => {
    const filters = parseCorporateStatementQueryParams(
      new URLSearchParams("customerEmail=accounts@acme.com"),
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(filters.customerEmail).toBe("accounts@acme.com");
    expect(filters.periodType).toBe("monthly");
    expect(filters.from).toBe("2026-07-01T00:00:00.000Z");
  });
});
