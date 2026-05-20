import { describe, expect, it } from "vitest";
import { adminAssignmentQueueScanLine } from "./adminAssignmentsPageDisplay";

describe("adminAssignmentQueueScanLine", () => {
  it("surfaces schedule, assignment label, next action, and same-day note", () => {
    const scan = adminAssignmentQueueScanLine(
      {
        scheduleLabel: "Wed 9 Jun · 14:00",
        assignmentAttention: "offered",
        assignmentReason: null,
        queueReason: "Offer sent — awaiting acceptance",
      },
      { sameDayNote: "Handover day — prioritize assignment." },
    );

    expect(scan.scheduleLabel).toBe("Wed 9 Jun · 14:00");
    expect(scan.assignmentLabel).toBe("Offer sent");
    expect(scan.nextAction).toBe("Offer sent — awaiting acceptance");
    expect(scan.sameDayNote).toBe("Handover day — prioritize assignment.");
  });
});
