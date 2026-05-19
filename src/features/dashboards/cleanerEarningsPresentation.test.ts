import { describe, expect, it } from "vitest";
import { formatZar } from "./server/parseBookingDisplay";
import {
  CLEANER_EARNINGS_CALCULATING_DISPLAY_LABEL,
  CLEANER_EARNINGS_CALCULATING_HELPER,
  EARNINGS_BEING_CALCULATED_SERVER_LABEL,
  labelForCleanerPayoutStatus,
  presentCleanerPayLine,
} from "./cleanerEarningsPresentation";

describe("cleanerEarningsPresentation", () => {
  it("maps calculating server label to calm cleaner copy", () => {
    const pay = presentCleanerPayLine(EARNINGS_BEING_CALCULATED_SERVER_LABEL, null, {
      includeCalculatingHelper: true,
    });

    expect(pay.isCalculating).toBe(true);
    expect(pay.amountText).toBe(CLEANER_EARNINGS_CALCULATING_DISPLAY_LABEL);
    expect(pay.helperText).toBe(CLEANER_EARNINGS_CALCULATING_HELPER);
    expect(pay.amountText).not.toContain("error");
  });

  it("passes through resolved currency amounts unchanged", () => {
    const label = formatZar(31_800);
    const pay = presentCleanerPayLine(label, 31_800);

    expect(pay.isCalculating).toBe(false);
    expect(pay.amountText).toBe(label);
    expect(pay.helperText).toBeUndefined();
  });

  it("uses calm cleaner payout status labels", () => {
    expect(labelForCleanerPayoutStatus("pending")).toBe("Pending payout");
    expect(labelForCleanerPayoutStatus("payout_ready")).toBe("Ready for payout");
    expect(labelForCleanerPayoutStatus("paid")).toBe("Paid");
    expect(labelForCleanerPayoutStatus("pending")).not.toContain("invalid");
  });
});
