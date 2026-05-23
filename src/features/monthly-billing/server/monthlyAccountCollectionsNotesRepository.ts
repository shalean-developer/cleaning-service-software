import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  MonthlyAccountCollectionsNoteRow,
  MonthlyAccountCollectionsNoteType,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";

export type MonthlyAccountCollectionsNote = {
  id: string;
  customerId: string;
  batchId: string | null;
  adminProfileId: string;
  noteType: MonthlyAccountCollectionsNoteType;
  content: string;
  reviewOwnerAdminId: string | null;
  followUpDate: string | null;
  resolution: string | null;
  createdAt: string;
};

function mapRow(row: MonthlyAccountCollectionsNoteRow): MonthlyAccountCollectionsNote {
  return {
    id: row.id,
    customerId: row.customer_id,
    batchId: row.batch_id,
    adminProfileId: row.admin_profile_id,
    noteType: row.note_type,
    content: row.content,
    reviewOwnerAdminId: row.review_owner_admin_id,
    followUpDate: row.follow_up_date,
    resolution: row.resolution,
    createdAt: row.created_at,
  };
}

export async function listMonthlyAccountCollectionsNotes(
  filters: { customerId?: string; batchId?: string; limit?: number },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyAccountCollectionsNote[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  let query = client
    .from("monthly_account_collections_notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.batchId) query = query.eq("batch_id", filters.batchId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as MonthlyAccountCollectionsNoteRow));
}

export async function createMonthlyAccountCollectionsNote(
  input: {
    customerId: string;
    batchId?: string | null;
    adminProfileId: string;
    noteType: MonthlyAccountCollectionsNoteType;
    content: string;
    idempotencyKey: string;
    reviewOwnerAdminId?: string | null;
    followUpDate?: string | null;
    resolution?: string | null;
  },
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyAccountCollectionsNote> {
  const { data, error } = await client
    .from("monthly_account_collections_notes")
    .insert({
      customer_id: input.customerId,
      batch_id: input.batchId ?? null,
      admin_profile_id: input.adminProfileId,
      note_type: input.noteType,
      content: input.content.trim(),
      review_owner_admin_id: input.reviewOwnerAdminId ?? null,
      follow_up_date: input.followUpDate ?? null,
      resolution: input.resolution ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const account = await getCustomerBillingAccount(input.customerId, client);
  await recordCustomerBillingAccountAudit(client, {
    accountId: account?.id ?? null,
    customerId: input.customerId,
    adminProfileId: input.adminProfileId,
    action: "monthly_collections_note_added",
    idempotencyKey: input.idempotencyKey,
    extra: {
      noteId: data!.id,
      noteType: input.noteType,
      batchId: input.batchId ?? null,
    },
  }).catch(() => undefined);

  return mapRow(data as MonthlyAccountCollectionsNoteRow);
}
