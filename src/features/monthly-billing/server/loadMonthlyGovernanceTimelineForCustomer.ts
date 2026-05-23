import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { buildMonthlyGovernanceTimeline } from "./buildMonthlyGovernanceTimeline";
import { listGovernanceAuditForCustomer } from "./customerBillingAccountGovernanceRepository";
import { listMonthlyAccountCollectionsNotes } from "./monthlyAccountCollectionsNotesRepository";
import type { MonthlyGovernanceTimelineEvent } from "../monthlyAccountGovernanceTypes";

async function loadAdminNamesById(
  profileIds: string[],
  client: SupabaseClient<Database>,
): Promise<Record<string, string | null>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await client.from("profiles").select("id, full_name").in("id", unique);
  if (error) throw new Error(error.message);

  const map: Record<string, string | null> = {};
  for (const row of data ?? []) {
    map[row.id] = row.full_name ?? null;
  }
  return map;
}

export async function loadMonthlyGovernanceTimelineForCustomer(
  customerId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
  limit = 100,
): Promise<MonthlyGovernanceTimelineEvent[]> {
  const [auditEntries, notes] = await Promise.all([
    listGovernanceAuditForCustomer(customerId, client, limit),
    listMonthlyAccountCollectionsNotes({ customerId, limit }),
  ]);

  const profileIds = [
    ...auditEntries.map((entry) => entry.adminProfileId),
    ...notes.map((note) => note.adminProfileId),
    ...notes.map((note) => note.reviewOwnerAdminId ?? ""),
  ];

  const adminNamesById = await loadAdminNamesById(profileIds, client);
  return buildMonthlyGovernanceTimeline({ auditEntries, notes, adminNamesById });
}
