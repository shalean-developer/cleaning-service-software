import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { logProductionRolloutEvent } from "./productionRolloutLogger";
import type {
  ProductionRolloutChecklistCategory,
  ProductionRolloutChecklistItem,
  ProductionRolloutChecklistKey,
} from "./productionRolloutTypes";
import { PRODUCTION_ROLLOUT_CHECKLIST_KEYS } from "./productionRolloutTypes";

type ChecklistRow = {
  id: string;
  checklist_key: string;
  label: string;
  category: string;
  completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
};

function mapChecklistRow(row: ChecklistRow): ProductionRolloutChecklistItem {
  return {
    id: row.id,
    checklistKey: row.checklist_key,
    label: row.label,
    category: row.category as ProductionRolloutChecklistCategory,
    completed: row.completed,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listProductionRolloutChecklist(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ProductionRolloutChecklistItem[]> {
  const { data, error } = await client
    .from("production_rollout_checklist")
    .select("*")
    .order("category", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapChecklistRow(row as ChecklistRow));
}

export async function updateProductionRolloutChecklistItem(input: {
  checklistKey: ProductionRolloutChecklistKey;
  completed: boolean;
  notes?: string;
  adminProfileId: string;
  client?: SupabaseClient<Database>;
}): Promise<ProductionRolloutChecklistItem> {
  const client = input.client ?? requireServiceRoleClient();

  if (!PRODUCTION_ROLLOUT_CHECKLIST_KEYS.includes(input.checklistKey)) {
    throw new Error("Invalid checklist key.");
  }

  const payload = {
    completed: input.completed,
    notes: input.notes?.trim() || null,
    completed_by: input.completed ? input.adminProfileId : null,
    completed_at: input.completed ? new Date().toISOString() : null,
  };

  const { data, error } = await client
    .from("production_rollout_checklist")
    .update(payload)
    .eq("checklist_key", input.checklistKey)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Checklist item not found.");

  const item = mapChecklistRow(data as ChecklistRow);

  logProductionRolloutEvent("production_rollout_checklist_updated", {
    checklistKey: input.checklistKey,
    completed: input.completed,
  });

  return item;
}
