import "server-only";

import { sanitizeLogDetails } from "@/lib/zoho/zohoInvoicePaymentLogger";

export const PRODUCTION_ROLLOUT_LOG_NAMESPACE = "finance:production-rollout" as const;

export type ProductionRolloutLogEvent =
  | "production_rollout_loaded"
  | "production_rollout_checklist_updated"
  | "production_rollout_exported"
  | "production_rollout_failed";

const INFO_EVENTS = new Set<ProductionRolloutLogEvent>([
  "production_rollout_loaded",
  "production_rollout_checklist_updated",
  "production_rollout_exported",
]);

export function logProductionRolloutEvent(
  event: ProductionRolloutLogEvent,
  details: Record<string, unknown> = {},
): void {
  const payload = JSON.stringify({
    namespace: PRODUCTION_ROLLOUT_LOG_NAMESPACE,
    event,
    at: new Date().toISOString(),
    ...sanitizeLogDetails(details),
  });

  if (INFO_EVENTS.has(event)) {
    console.info(payload);
  } else {
    console.warn(payload);
  }
}
