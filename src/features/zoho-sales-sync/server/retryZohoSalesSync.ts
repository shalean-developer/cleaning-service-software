import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isZohoSalesSyncEnabled } from "./zohoSalesSyncLaunchGuard";
import {
  listRetryableZohoSalesSyncRows,
  type ZohoSalesSyncRetryFilters,
} from "./zohoSalesSyncRepository";
import { registerExistingZohoSalesSyncRows } from "./registerExistingZohoSalesSync";
import { syncShaleanSaleToZoho } from "./syncShaleanSaleToZoho";

export type RetryZohoSalesSyncSummary = {
  attempted: number;
  synced: number;
  failed: number;
  skipped: number;
  registeredInvoicePayments: number;
  registeredAuthCharges: number;
};

export async function retryZohoSalesSync(
  filters: ZohoSalesSyncRetryFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<RetryZohoSalesSyncSummary> {
  const summary: RetryZohoSalesSyncSummary = {
    attempted: 0,
    synced: 0,
    failed: 0,
    skipped: 0,
    registeredInvoicePayments: 0,
    registeredAuthCharges: 0,
  };

  if (!isZohoSalesSyncEnabled()) {
    return summary;
  }

  const registration = await registerExistingZohoSalesSyncRows(client);
  summary.registeredInvoicePayments = registration.registeredInvoicePayments;
  summary.registeredAuthCharges = registration.registeredAuthCharges;

  const rows = await listRetryableZohoSalesSyncRows(filters, client);

  for (const row of rows) {
    summary.attempted += 1;
    const result = await syncShaleanSaleToZoho(row.source_type, row.source_id, client);
    if (result.ok && result.syncStatus === "synced") {
      summary.synced += 1;
    } else if (result.ok && result.syncStatus === "skipped") {
      summary.skipped += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}
