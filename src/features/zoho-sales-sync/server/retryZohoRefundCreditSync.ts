import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isZohoRefundCreditSyncEnabled } from "./zohoRefundCreditSyncLaunchGuard";
import {
  listZohoRefundCreditSyncPending,
  type ZohoRefundCreditSyncListFilters,
} from "./zohoRefundCreditSyncRepository";
import { syncZohoRefundCreditToZoho } from "./syncZohoRefundCreditToZoho";

export type RetryZohoRefundCreditSyncSummary = {
  attempted: number;
  synced: number;
  failed: number;
  skipped: number;
};

export async function retryZohoRefundCreditSync(
  filters: ZohoRefundCreditSyncListFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<RetryZohoRefundCreditSyncSummary> {
  const summary: RetryZohoRefundCreditSyncSummary = {
    attempted: 0,
    synced: 0,
    failed: 0,
    skipped: 0,
  };

  if (!isZohoRefundCreditSyncEnabled()) {
    return summary;
  }

  const rows = await listZohoRefundCreditSyncPending(filters, client);

  for (const row of rows) {
    summary.attempted += 1;
    const result = await syncZohoRefundCreditToZoho(row.source_type, row.source_id, client);
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
