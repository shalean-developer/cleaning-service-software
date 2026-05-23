import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseAdminAssistQaChecklistItems,
  type AdminAssistQaChecklist,
  type AdminAssistQaChecklistItems,
} from "@/features/bookings/adminAssistQaChecklistShared";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    error.code === "PGRST205" ||
    error.code === "42P01"
  );
}

export async function loadAdminAssistQaChecklist(
  bookingId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistQaChecklist | null> {
  const { data, error } = await client
    .from("admin_assisted_qa_checklist")
    .select("booking_id, admin_profile_id, items, updated_at")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  return {
    bookingId: data.booking_id,
    adminProfileId: data.admin_profile_id,
    items: parseAdminAssistQaChecklistItems(data.items),
    updatedAt: data.updated_at,
  };
}

export async function upsertAdminAssistQaChecklist(input: {
  bookingId: string;
  adminProfileId: string;
  items: AdminAssistQaChecklistItems;
  client?: SupabaseClient<Database>;
}): Promise<AdminAssistQaChecklist> {
  const client = input.client ?? requireServiceRoleClient();
  const { data, error } = await client
    .from("admin_assisted_qa_checklist")
    .upsert(
      {
        booking_id: input.bookingId,
        admin_profile_id: input.adminProfileId,
        items: input.items,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "booking_id" },
    )
    .select("booking_id, admin_profile_id, items, updated_at")
    .single();

  if (error) throw new Error(error.message);

  return {
    bookingId: data.booking_id,
    adminProfileId: data.admin_profile_id,
    items: parseAdminAssistQaChecklistItems(data.items),
    updatedAt: data.updated_at,
  };
}
