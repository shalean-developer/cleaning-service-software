import { describe, expect, it } from "vitest";
import {
  calculateInclusiveVat,
  calculateNetExcludingVat,
  calculateSignedVatForLineItem,
} from "./vatCalculator";

describe("vatCalculator", () => {
  it("calculates R115 at 15% inclusive VAT as R15 VAT and R100 net", () => {
    expect(calculateInclusiveVat(11500, 15)).toBe(1500);
    expect(calculateNetExcludingVat(11500, 15)).toBe(10000);
  });

  it("calculates R230 at 15% inclusive VAT as R30 VAT and R200 net", () => {
    expect(calculateInclusiveVat(23000, 15)).toBe(3000);
    expect(calculateNetExcludingVat(23000, 15)).toBe(20000);
  });

  it("calculates negative VAT for refund amounts", () => {
    expect(calculateSignedVatForLineItem(-11500, 15)).toBe(-1500);
    expect(calculateNetExcludingVat(-11500, 15)).toBe(-10000);
  });

  it("returns zero VAT when vatRegistered is false", () => {
    expect(calculateInclusiveVat(11500, 15, false)).toBe(0);
    expect(calculateNetExcludingVat(11500, 15, false)).toBe(11500);
    expect(calculateSignedVatForLineItem(-5000, 15, false)).toBe(0);
  });
});
