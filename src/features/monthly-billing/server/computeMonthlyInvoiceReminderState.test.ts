import { describe, expect, it } from "vitest";
import { computeMonthlyInvoiceReminderState } from "./computeMonthlyInvoiceReminderState";

describe("computeMonthlyInvoiceReminderState", () => {
  const dueDate = "2026-06-15";

  it("schedules before-due reminder 3 days early", () => {
    const evaluation = computeMonthlyInvoiceReminderState({
      batchStatus: "sent",
      dueDate,
      metadata: {},
      now: new Date("2026-06-12T10:00:00.000Z"),
    });
    expect(evaluation.state).toBe("reminder_due");
    expect(evaluation.stageId).toBe("before_due_3d");
  });

  it("enforces max reminder per stage", () => {
    const evaluation = computeMonthlyInvoiceReminderState({
      batchStatus: "sent",
      dueDate,
      metadata: {
        delivery: {
          reminderStagesSent: ["before_due_3d"],
        },
      },
      now: new Date("2026-06-12T10:00:00.000Z"),
    });
    expect(evaluation.stageId).not.toBe("before_due_3d");
  });

  it("skips paid invoices", () => {
    const evaluation = computeMonthlyInvoiceReminderState({
      batchStatus: "paid",
      dueDate,
      metadata: {},
      now: new Date("2026-06-20T10:00:00.000Z"),
    });
    expect(evaluation.state).toBe("no_action");
  });

  it("skips disputed invoices", () => {
    const evaluation = computeMonthlyInvoiceReminderState({
      batchStatus: "sent",
      dueDate,
      metadata: { delivery: { collectionsState: "disputed" } },
      now: new Date("2026-06-20T10:00:00.000Z"),
    });
    expect(evaluation.state).toBe("no_action");
  });

  it("marks escalation due after overdue cadence stages", () => {
    const evaluation = computeMonthlyInvoiceReminderState({
      batchStatus: "overdue",
      dueDate,
      metadata: {
        delivery: {
          reminderStagesSent: [
            "before_due_3d",
            "due_date",
            "overdue_3d",
            "overdue_7d",
            "overdue_14d",
          ],
          reminderCount: 5,
        },
      },
      now: new Date("2026-07-01T10:00:00.000Z"),
    });
    expect(evaluation.state).toBe("escalation_due");
    expect(evaluation.collectionsState).toBe("escalation_recommended");
  });
});
