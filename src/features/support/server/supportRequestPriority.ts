const MS_24H = 24 * 60 * 60 * 1000;

export type SupportRequestPriority = "urgent" | "normal" | "low";
export type SupportSlaCategory = "urgent" | "standard";

function isCancelOrRescheduleType(type: string): boolean {
  return type.includes("cancel") || type.includes("reschedule");
}

/** Triage priority for support requests (visibility only — no booking mutations). */
export function supportRequestPriority(input: {
  status: string;
  requestType: string;
  createdAt: string;
  scheduledStart: string | null;
  requestedDateTimeIso: string | null;
  now?: Date;
}): SupportRequestPriority {
  if (input.status === "resolved" || input.status === "rejected") return "low";
  if (input.status === "acknowledged") return "normal";

  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const createdMs = new Date(input.createdAt).getTime();
  if (nowMs - createdMs > MS_24H) return "urgent";

  if (input.requestType === "payment_help") return "urgent";
  if (input.requestType === "cleaner_issue" || input.requestType === "service_issue") {
    return "urgent";
  }

  if (isCancelOrRescheduleType(input.requestType)) {
    const targetIso = input.scheduledStart ?? input.requestedDateTimeIso;
    if (targetIso) {
      const targetMs = new Date(targetIso).getTime();
      if (targetMs > nowMs && targetMs - nowMs <= MS_24H) return "urgent";
    }
  }

  return "normal";
}

/** SLA category — urgent vs standard response/resolution targets. */
export function supportRequestSlaCategory(input: {
  requestType: string;
  scheduledStart: string | null;
  requestedDateTimeIso: string | null;
  now?: Date;
}): SupportSlaCategory {
  if (
    input.requestType === "payment_help" ||
    input.requestType === "cleaner_issue" ||
    input.requestType === "service_issue"
  ) {
    return "urgent";
  }
  if (isCancelOrRescheduleType(input.requestType)) {
    const now = input.now ?? new Date();
    const targetIso = input.scheduledStart ?? input.requestedDateTimeIso;
    if (targetIso) {
      const targetMs = new Date(targetIso).getTime();
      if (targetMs > now.getTime() && targetMs - now.getTime() <= MS_24H) {
        return "urgent";
      }
    }
    return "standard";
  }
  return "standard";
}

export function supportRequestUrgencyReason(input: {
  status: string;
  requestType: string;
  createdAt: string;
  scheduledStart: string | null;
  requestedDateTimeIso: string | null;
  now?: Date;
}): string | null {
  if (input.status === "resolved" || input.status === "rejected") return null;
  const now = input.now ?? new Date();
  const ageH = (now.getTime() - new Date(input.createdAt).getTime()) / (60 * 60 * 1000);
  if (input.status === "open" && ageH >= 24) return "Open more than 24 hours";
  if (input.requestType === "payment_help") return "Payment help requested";
  if (input.requestType === "cleaner_issue") return "Cleaner issue reported";
  if (input.requestType === "service_issue") return "Service issue reported";
  if (isCancelOrRescheduleType(input.requestType)) {
    const targetIso = input.scheduledStart ?? input.requestedDateTimeIso;
    if (targetIso) {
      const hours = (new Date(targetIso).getTime() - now.getTime()) / (60 * 60 * 1000);
      if (hours > 0 && hours <= 24) return "Visit or change within 24 hours";
    }
  }
  return null;
}

/** @deprecated Use supportRequestPriority — kept for audit/read-model parity export name. */
export function computeSupportInboxPriorityForTest(
  input: Parameters<typeof supportRequestPriority>[0],
): SupportRequestPriority {
  return supportRequestPriority(input);
}
