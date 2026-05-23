import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoiceAutomationEnabled } from "@/lib/app/zohoMonthlyInvoiceAutomationFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { resolveMonthlyInvoiceDueDate } from "./enqueueMonthlyInvoiceNotification";
import { computeMonthlyInvoiceReminderState } from "./computeMonthlyInvoiceReminderState";
import { sendMonthlyInvoiceReminder } from "./sendMonthlyInvoiceReminder";
import { updateBatchDeliveryMetadata } from "./monthlyInvoiceDeliveryRepository";
import { readMonthlyInvoiceDeliveryMetadata } from "./monthlyInvoiceDeliveryTypes";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type ProcessMonthlyInvoiceRemindersCronSummary = {
  scanned: number;
  remindersSent: number;
  escalations: number;
  skipped: number;
  failed: number;
};

export async function processMonthlyInvoiceRemindersForCron(
  limit: number,
  client: SupabaseClient<Database>,
): Promise<ProcessMonthlyInvoiceRemindersCronSummary> {
  if (!isZohoMonthlyInvoiceAutomationEnabled()) {
    return { scanned: 0, remindersSent: 0, escalations: 0, skipped: 0, failed: 0 };
  }

  const batches = await listMonthlyInvoiceBatches({ limit: Math.min(limit, 200) }, client);
  const unpaid = batches.filter((b) => b.status === "sent" || b.status === "overdue");

  let remindersSent = 0;
  let escalations = 0;
  let skipped = 0;
  let failed = 0;

  for (const batch of unpaid) {
    const billingAccount = await getCustomerBillingAccount(batch.customerId, client);
    const dueDate = billingAccount ? resolveMonthlyInvoiceDueDate(batch, billingAccount) : null;
    const evaluation = computeMonthlyInvoiceReminderState({
      batchStatus: batch.status,
      dueDate,
      metadata: batch.metadata,
    });

    if (evaluation.state === "no_action") {
      if (evaluation.nextReminderAt) {
        await updateBatchDeliveryMetadata(client, batch, {
          nextReminderAt: evaluation.nextReminderAt,
          collectionsState: evaluation.collectionsState,
        }).catch(() => undefined);
      }
      skipped += 1;
      continue;
    }

    if (!evaluation.stageId) {
      skipped += 1;
      continue;
    }

    const delivery = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
    if (delivery.reminderStagesSent.includes(evaluation.stageId)) {
      skipped += 1;
      continue;
    }

    const result = await sendMonthlyInvoiceReminder({
      batchId: batch.id,
      adminProfileId: null,
      idempotencyKey: `cron-reminder:${batch.id}:${evaluation.stageId}`,
      reason: `Scheduled reminder (${evaluation.stageId})`,
      client,
    });

    if (!result.ok) {
      failed += 1;
      continue;
    }

    const refreshed = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
    await updateBatchDeliveryMetadata(client, batch, {
      reminderStagesSent: [...refreshed.reminderStagesSent, evaluation.stageId],
      collectionsState: evaluation.collectionsState,
      escalationLevel: evaluation.state === "escalation_due" ? delivery.escalationLevel + 1 : delivery.escalationLevel,
      nextReminderAt: evaluation.nextReminderAt,
    }).catch(() => undefined);

    await recordCustomerBillingAccountAudit(client, {
      accountId: billingAccount?.id ?? null,
      customerId: batch.customerId,
      adminProfileId: null,
      action: "monthly_invoice_reminder_scheduled",
      idempotencyKey: `cron-reminder-audit:${batch.id}:${evaluation.stageId}`,
      extra: { batchId: batch.id, stageId: evaluation.stageId, state: evaluation.state },
    }).catch(() => undefined);

    if (evaluation.state === "escalation_due") escalations += 1;
    else remindersSent += 1;
  }

  return {
    scanned: unpaid.length,
    remindersSent,
    escalations,
    skipped,
    failed,
  };
}
