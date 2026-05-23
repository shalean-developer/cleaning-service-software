import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { autoSendMonthlyInvoiceAfterGeneration } from "./autoSendMonthlyInvoiceAfterGeneration";
import { initializeBatchDeliveryMetadata } from "./monthlyInvoiceDeliveryRepository";

export async function runPostGenerationMonthlyInvoiceAutoSend(
  batchId: string,
  client: SupabaseClient<Database>,
): Promise<void> {
  await initializeBatchDeliveryMetadata(client, batchId, true).catch(() => undefined);
  await autoSendMonthlyInvoiceAfterGeneration({ batchId, client }).catch(() => undefined);
}
