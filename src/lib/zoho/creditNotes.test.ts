import { describe, expect, it } from "vitest";
import { buildShaleanCreditNoteReference } from "@/lib/zoho/creditNotes";
import { centsToZohoDecimalAmount } from "@/lib/zoho/customerPayments";

describe("creditNotes", () => {
  it("maps cents to Zoho decimal Rand", () => {
    expect(centsToZohoDecimalAmount(12345)).toBe(123.45);
    expect(centsToZohoDecimalAmount(100)).toBe(1);
  });

  it("builds Shalean credit note reference", () => {
    expect(buildShaleanCreditNoteReference("booking-1")).toBe("SHALEAN-CR-booking-1");
  });
});
