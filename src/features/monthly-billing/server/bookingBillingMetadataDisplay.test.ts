import { describe, expect, it } from "vitest";
import {
  parseBookingBillingMetadata,
} from "@/features/monthly-billing/server/bookingBillingMetadataDisplay";

describe("parseBookingBillingMetadata", () => {
  it("returns null when billing metadata is absent", () => {
    expect(parseBookingBillingMetadata({})).toBeNull();
    expect(parseBookingBillingMetadata(null)).toBeNull();
  });

  it("parses billing mode and ids from metadata", () => {
    expect(
      parseBookingBillingMetadata({
        billing: {
          mode: "monthly_account",
          monthlyAccountId: "acc-1",
          invoiceBatchId: "batch-1",
        },
      }),
    ).toEqual({
      mode: "monthly_account",
      monthlyAccountId: "acc-1",
      invoiceBatchId: "batch-1",
    });
  });
});
