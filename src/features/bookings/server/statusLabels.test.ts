import { describe, expect, it } from "vitest";
import {
  labelForBookingStatus,
  labelForCleanerJobStatus,
  toneForBookingStatus,
  toneForCleanerJobStatus,
} from "./statusLabels";

describe("labelForCleanerJobStatus", () => {
  it("maps cleaner-facing job statuses", () => {
    expect(labelForCleanerJobStatus("assigned")).toBe("Scheduled");
    expect(labelForCleanerJobStatus("pending_assignment")).toBe("Awaiting cleaner");
    expect(labelForCleanerJobStatus("in_progress")).toBe("In progress");
    expect(labelForCleanerJobStatus("completed")).toBe("Completed");
    expect(labelForCleanerJobStatus("payout_ready")).toBe("Completed");
    expect(labelForCleanerJobStatus("paid_out")).toBe("Paid");
  });

  it("uses safe labels for uncommon payment states", () => {
    expect(labelForCleanerJobStatus("pending_payment")).toBe("Awaiting payment");
    expect(labelForCleanerJobStatus("payment_failed")).toBe("Payment issue");
  });

  it("does not change admin booking status labels", () => {
    expect(labelForBookingStatus("assigned")).toBe("Cleaner assigned");
    expect(labelForBookingStatus("payout_ready")).toBe("Payout ready");
    expect(labelForBookingStatus("paid_out")).toBe("Paid out");
  });
});

describe("toneForCleanerJobStatus", () => {
  it("treats payout_ready like completed success", () => {
    expect(toneForCleanerJobStatus("payout_ready")).toBe("success");
    expect(toneForCleanerJobStatus("paid_out")).toBe("success");
    expect(toneForBookingStatus("payout_ready")).toBe("info");
  });
});
