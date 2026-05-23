import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

export async function loadAdminAssistOperatorNames(
  client: SupabaseClient<Database>,
  profileIds: string[],
): Promise<Record<string, string>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const { data, error } = await client.from("profiles").select("id, full_name").in("id", unique);
  if (error || !data) return {};

  const map: Record<string, string> = {};
  for (const row of data) {
    const name = row.full_name?.trim();
    if (name) map[row.id] = name;
  }
  return map;
}
