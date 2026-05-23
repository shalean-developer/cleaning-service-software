import "server-only";

export const MONTHLY_INVOICE_COLLECTIONS_STATES = [
  "healthy",
  "reminder_due",
  "overdue",
  "escalation_recommended",
  "finance_review",
  "disputed",
  "high_risk",
] as const;

export type MonthlyInvoiceCollectionsState = (typeof MONTHLY_INVOICE_COLLECTIONS_STATES)[number];

export type MonthlyInvoiceDeliveryChannelRecord = {
  channel: "email";
  outboxId: string;
  queuedAt: string;
  status: "queued" | "sent" | "failed" | "bounced";
};

export type MonthlyInvoiceDeliveryMetadata = {
  autoSendEnabled: boolean;
  sentChannels: MonthlyInvoiceDeliveryChannelRecord[];
  lastSentAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  deliveryFailures: number;
  lastDeliveryStatus: "queued" | "sent" | "failed" | "bounced" | null;
  nextReminderAt: string | null;
  escalationLevel: number;
  collectionsState: MonthlyInvoiceCollectionsState;
  reminderStagesSent: string[];
  lastSuccessfulDeliveryAt: string | null;
};

const DELIVERY_KEY = "delivery";

const DEFAULT_DELIVERY: MonthlyInvoiceDeliveryMetadata = {
  autoSendEnabled: true,
  sentChannels: [],
  lastSentAt: null,
  lastReminderAt: null,
  reminderCount: 0,
  deliveryFailures: 0,
  lastDeliveryStatus: null,
  nextReminderAt: null,
  escalationLevel: 0,
  collectionsState: "healthy",
  reminderStagesSent: [],
  lastSuccessfulDeliveryAt: null,
};

function readDeliveryRoot(metadata: Record<string, unknown>): Record<string, unknown> {
  const root = metadata[DELIVERY_KEY];
  if (root == null || typeof root !== "object" || Array.isArray(root)) return {};
  return root as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readSentChannels(value: unknown): MonthlyInvoiceDeliveryChannelRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is MonthlyInvoiceDeliveryChannelRecord => {
      if (item == null || typeof item !== "object" || Array.isArray(item)) return false;
      const row = item as Record<string, unknown>;
      return (
        row.channel === "email" &&
        typeof row.outboxId === "string" &&
        typeof row.queuedAt === "string" &&
        (row.status === "queued" ||
          row.status === "sent" ||
          row.status === "failed" ||
          row.status === "bounced")
      );
    })
    .slice(-50);
}

export function readMonthlyInvoiceDeliveryMetadata(
  metadata: Record<string, unknown>,
): MonthlyInvoiceDeliveryMetadata {
  const delivery = readDeliveryRoot(metadata);
  const collectionsStateRaw = delivery.collectionsState;
  const collectionsState = MONTHLY_INVOICE_COLLECTIONS_STATES.includes(
    collectionsStateRaw as MonthlyInvoiceCollectionsState,
  )
    ? (collectionsStateRaw as MonthlyInvoiceCollectionsState)
    : "healthy";

  const reminderCountRaw = delivery.reminderCount;
  const reminderCount =
    typeof reminderCountRaw === "number" && Number.isFinite(reminderCountRaw)
      ? Math.max(0, Math.floor(reminderCountRaw))
      : 0;

  const deliveryFailuresRaw = delivery.deliveryFailures;
  const deliveryFailures =
    typeof deliveryFailuresRaw === "number" && Number.isFinite(deliveryFailuresRaw)
      ? Math.max(0, Math.floor(deliveryFailuresRaw))
      : 0;

  const escalationLevelRaw = delivery.escalationLevel;
  const escalationLevel =
    typeof escalationLevelRaw === "number" && Number.isFinite(escalationLevelRaw)
      ? Math.max(0, Math.floor(escalationLevelRaw))
      : 0;

  const lastDeliveryStatusRaw = delivery.lastDeliveryStatus;
  const lastDeliveryStatus =
    lastDeliveryStatusRaw === "queued" ||
    lastDeliveryStatusRaw === "sent" ||
    lastDeliveryStatusRaw === "failed" ||
    lastDeliveryStatusRaw === "bounced"
      ? lastDeliveryStatusRaw
      : null;

  return {
    autoSendEnabled:
      typeof delivery.autoSendEnabled === "boolean" ? delivery.autoSendEnabled : true,
    sentChannels: readSentChannels(delivery.sentChannels),
    lastSentAt:
      typeof delivery.lastSentAt === "string" && delivery.lastSentAt.trim()
        ? delivery.lastSentAt.trim()
        : null,
    lastReminderAt:
      typeof delivery.lastReminderAt === "string" && delivery.lastReminderAt.trim()
        ? delivery.lastReminderAt.trim()
        : null,
    reminderCount,
    deliveryFailures,
    lastDeliveryStatus,
    nextReminderAt:
      typeof delivery.nextReminderAt === "string" && delivery.nextReminderAt.trim()
        ? delivery.nextReminderAt.trim()
        : null,
    escalationLevel,
    collectionsState,
    reminderStagesSent: readStringArray(delivery.reminderStagesSent),
    lastSuccessfulDeliveryAt:
      typeof delivery.lastSuccessfulDeliveryAt === "string" && delivery.lastSuccessfulDeliveryAt.trim()
        ? delivery.lastSuccessfulDeliveryAt.trim()
        : null,
  };
}

export function buildMonthlyInvoiceDeliveryMetadata(
  existingMetadata: Record<string, unknown>,
  patch: Partial<MonthlyInvoiceDeliveryMetadata>,
): Record<string, unknown> {
  const current = readMonthlyInvoiceDeliveryMetadata(existingMetadata);
  const merged: MonthlyInvoiceDeliveryMetadata = {
    autoSendEnabled:
      patch.autoSendEnabled !== undefined ? patch.autoSendEnabled : current.autoSendEnabled,
    sentChannels: patch.sentChannels !== undefined ? patch.sentChannels : current.sentChannels,
    lastSentAt: patch.lastSentAt !== undefined ? patch.lastSentAt : current.lastSentAt,
    lastReminderAt:
      patch.lastReminderAt !== undefined ? patch.lastReminderAt : current.lastReminderAt,
    reminderCount: patch.reminderCount !== undefined ? patch.reminderCount : current.reminderCount,
    deliveryFailures:
      patch.deliveryFailures !== undefined ? patch.deliveryFailures : current.deliveryFailures,
    lastDeliveryStatus:
      patch.lastDeliveryStatus !== undefined ? patch.lastDeliveryStatus : current.lastDeliveryStatus,
    nextReminderAt:
      patch.nextReminderAt !== undefined ? patch.nextReminderAt : current.nextReminderAt,
    escalationLevel:
      patch.escalationLevel !== undefined ? patch.escalationLevel : current.escalationLevel,
    collectionsState:
      patch.collectionsState !== undefined ? patch.collectionsState : current.collectionsState,
    reminderStagesSent:
      patch.reminderStagesSent !== undefined ? patch.reminderStagesSent : current.reminderStagesSent,
    lastSuccessfulDeliveryAt:
      patch.lastSuccessfulDeliveryAt !== undefined
        ? patch.lastSuccessfulDeliveryAt
        : current.lastSuccessfulDeliveryAt,
  };

  return {
    ...existingMetadata,
    [DELIVERY_KEY]: merged,
  };
}

export function isCollectionsAutomationBlockedState(state: MonthlyInvoiceCollectionsState): boolean {
  return state === "disputed" || state === "finance_review";
}

export function daysBetweenDates(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso.slice(0, 10)}T12:00:00.000Z`).getTime();
  const to = new Date(`${toIso.slice(0, 10)}T12:00:00.000Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

export function computeInvoiceAgingBucket(dueDate: string | null, now = new Date()): string {
  if (!dueDate) return "current";
  const daysPast = daysBetweenDates(dueDate, now.toISOString());
  if (daysPast <= 0) return "current";
  if (daysPast <= 30) return "1-30";
  if (daysPast <= 60) return "31-60";
  if (daysPast <= 90) return "61-90";
  return "90+";
}
