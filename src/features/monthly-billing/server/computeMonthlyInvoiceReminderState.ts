import "server-only";

import type { MonthlyInvoiceBatchStatus } from "@/lib/database/types";
import { isDueDatePast } from "./monthlyInvoiceOperationsTypes";
import {
  isCollectionsAutomationBlockedState,
  readMonthlyInvoiceDeliveryMetadata,
  type MonthlyInvoiceCollectionsState,
} from "./monthlyInvoiceDeliveryTypes";

export const REMINDER_CADENCE_STAGES = [
  { id: "before_due_3d", offsetDays: -3, maxPerStage: 1 },
  { id: "due_date", offsetDays: 0, maxPerStage: 1 },
  { id: "overdue_3d", offsetDays: 3, maxPerStage: 1 },
  { id: "overdue_7d", offsetDays: 7, maxPerStage: 1 },
  { id: "overdue_14d", offsetDays: 14, maxPerStage: 1 },
] as const;

export type MonthlyInvoiceReminderState = "no_action" | "reminder_due" | "escalation_due";

export type MonthlyInvoiceReminderEvaluation = {
  state: MonthlyInvoiceReminderState;
  stageId: string | null;
  nextReminderAt: string | null;
  collectionsState: MonthlyInvoiceCollectionsState;
};

function dateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysToDateIso(dateIso: string, days: number): string {
  const base = new Date(`${dateIso.slice(0, 10)}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return dateOnlyIso(base);
}

export function computeMonthlyInvoiceReminderState(input: {
  batchStatus: MonthlyInvoiceBatchStatus;
  dueDate: string | null;
  metadata: Record<string, unknown>;
  now?: Date;
}): MonthlyInvoiceReminderEvaluation {
  const now = input.now ?? new Date();
  const today = dateOnlyIso(now);
  const delivery = readMonthlyInvoiceDeliveryMetadata(input.metadata);

  if (input.batchStatus === "paid" || input.batchStatus === "void") {
    return {
      state: "no_action",
      stageId: null,
      nextReminderAt: null,
      collectionsState: "healthy",
    };
  }

  if (isCollectionsAutomationBlockedState(delivery.collectionsState)) {
    return {
      state: "no_action",
      stageId: null,
      nextReminderAt: delivery.nextReminderAt,
      collectionsState: delivery.collectionsState,
    };
  }

  if (!input.dueDate) {
    return {
      state: "no_action",
      stageId: null,
      nextReminderAt: null,
      collectionsState: input.batchStatus === "overdue" ? "overdue" : "healthy",
    };
  }

  if (input.batchStatus !== "sent" && input.batchStatus !== "overdue" && input.batchStatus !== "generated") {
    return {
      state: "no_action",
      stageId: null,
      nextReminderAt: delivery.nextReminderAt,
      collectionsState: delivery.collectionsState,
    };
  }

  const duePast = isDueDatePast(input.dueDate, now);
  let collectionsState: MonthlyInvoiceCollectionsState = "healthy";
  if (delivery.collectionsState === "finance_review" || delivery.collectionsState === "disputed") {
    collectionsState = delivery.collectionsState;
  } else if (duePast || input.batchStatus === "overdue") {
    collectionsState = "overdue";
  } else if (today >= addDaysToDateIso(input.dueDate, -3)) {
    collectionsState = "reminder_due";
  }

  for (const stage of REMINDER_CADENCE_STAGES) {
    const stageDate = addDaysToDateIso(input.dueDate, stage.offsetDays);
    const stageSentCount = delivery.reminderStagesSent.filter((id) => id === stage.id).length;
    if (stageSentCount >= stage.maxPerStage) continue;
    if (today >= stageDate) {
      const isEscalation = stage.offsetDays >= 7;
      return {
        state: isEscalation ? "escalation_due" : "reminder_due",
        stageId: stage.id,
        nextReminderAt: null,
        collectionsState: isEscalation ? "escalation_recommended" : collectionsState,
      };
    }
    return {
      state: "no_action",
      stageId: null,
      nextReminderAt: `${stageDate}T08:00:00.000Z`,
      collectionsState,
    };
  }

  if (duePast && delivery.reminderCount >= REMINDER_CADENCE_STAGES.length) {
    return {
      state: "escalation_due",
      stageId: null,
      nextReminderAt: null,
      collectionsState: "escalation_recommended",
    };
  }

  return {
    state: "no_action",
    stageId: null,
    nextReminderAt: delivery.nextReminderAt,
    collectionsState,
  };
}
