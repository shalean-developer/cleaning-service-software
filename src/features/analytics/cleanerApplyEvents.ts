/**
 * Cleaner apply funnel analytics. fire-and-forget; never blocks submission.
 */

export type CleanerApplyEventName =
  | "cleaner_apply_view"
  | "cleaner_apply_started"
  | "cleaner_apply_step_completed"
  | "cleaner_apply_submitted"
  | "cleaner_application_duplicate"
  | "cleaner_application_approved"
  | "admin_cleaner_application_approved"
  | "admin_cleaner_application_converted";

type EventPayload = Record<string, string | number | boolean | undefined>;

function pushEvent(name: CleanerApplyEventName, payload?: EventPayload): void {
  try {
    if (typeof window !== "undefined") {
      const w = window as Window & { dataLayer?: EventPayload[] };
      w.dataLayer = w.dataLayer ?? [];
      w.dataLayer.push({ event: name, ...payload });
    }
  } catch {
    // ignore
  }
}

export function trackCleanerApplyView(): void {
  pushEvent("cleaner_apply_view");
}

export function trackCleanerApplyStarted(): void {
  pushEvent("cleaner_apply_started");
}

export function trackCleanerApplyStepCompleted(step: number, stepId: string): void {
  pushEvent("cleaner_apply_step_completed", { step, stepId });
}

export function trackCleanerApplySubmitted(payload?: {
  status: string;
  duplicate?: boolean;
}): void {
  pushEvent(
    payload?.duplicate ? "cleaner_application_duplicate" : "cleaner_apply_submitted",
    payload,
  );
}

export function trackAdminCleanerApplicationApproved(applicationId: string): void {
  pushEvent("admin_cleaner_application_approved", { applicationId });
  pushEvent("cleaner_application_approved", { applicationId });
}

export function trackAdminCleanerApplicationConverted(applicationId: string): void {
  pushEvent("admin_cleaner_application_converted", { applicationId });
}
