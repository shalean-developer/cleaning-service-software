import { describe, expect, it } from "vitest";
import { centsToZohoDecimalAmount } from "./customerPayments";

describe("customerPayments helpers", () => {
  it("converts cents to Zoho decimal Rand amount", () => {
    expect(centsToZohoDecimalAmount(10_000)).toBe(100);
    expect(centsToZohoDecimalAmount(12_345)).toBe(123.45);
  });
});
