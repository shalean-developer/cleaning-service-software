import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

export type AdminAssistedOperatorFeedback = {
  id: string;
  bookingId: string;
  adminProfileId: string;
  confusingText: string | null;
  slowedDownText: string | null;
  paymentSucceeded: boolean | null;
  customerUnderstood: boolean | null;
  notes: string | null;
  createdAt: string;
};

export type AdminAssistedOperatorFeedbackInput = {
  bookingId: string;
  adminProfileId: string;
  confusingText?: string | null;
  slowedDownText?: string | null;
  paymentSucceeded?: boolean | null;
  customerUnderstood?: boolean | null;
  notes?: string | null;
};

function trimOrNull(value: string | null | undefined, maxLen: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export async function recordAdminAssistedOperatorFeedback(
  input: AdminAssistedOperatorFeedbackInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedOperatorFeedback> {
  const { data, error } = await client
    .from("admin_assisted_operator_feedback")
    .insert({
      booking_id: input.bookingId,
      admin_profile_id: input.adminProfileId,
      confusing_text: trimOrNull(input.confusingText, 1000),
      slowed_down_text: trimOrNull(input.slowedDownText, 1000),
      payment_succeeded: input.paymentSucceeded ?? null,
      customer_understood: input.customerUnderstood ?? null,
      notes: trimOrNull(input.notes, 2000),
    })
    .select(
      "id, booking_id, admin_profile_id, confusing_text, slowed_down_text, payment_succeeded, customer_understood, notes, created_at",
    )
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    bookingId: data.booking_id,
    adminProfileId: data.admin_profile_id,
    confusingText: data.confusing_text,
    slowedDownText: data.slowed_down_text,
    paymentSucceeded: data.payment_succeeded,
    customerUnderstood: data.customer_understood,
    notes: data.notes,
    createdAt: data.created_at,
  };
}

export async function loadAdminAssistedOperatorFeedbackForBooking(
  bookingId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedOperatorFeedback[]> {
  const { data, error } = await client
    .from("admin_assisted_operator_feedback")
    .select(
      "id, booking_id, admin_profile_id, confusing_text, slowed_down_text, payment_succeeded, customer_understood, notes, created_at",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    adminProfileId: row.admin_profile_id,
    confusingText: row.confusing_text,
    slowedDownText: row.slowed_down_text,
    paymentSucceeded: row.payment_succeeded,
    customerUnderstood: row.customer_understood,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function loadRecentAdminAssistedOperatorFeedback(
  limit = 50,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedOperatorFeedback[]> {
  const { data, error } = await client
    .from("admin_assisted_operator_feedback")
    .select(
      "id, booking_id, admin_profile_id, confusing_text, slowed_down_text, payment_succeeded, customer_understood, notes, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    adminProfileId: row.admin_profile_id,
    confusingText: row.confusing_text,
    slowedDownText: row.slowed_down_text,
    paymentSucceeded: row.payment_succeeded,
    customerUnderstood: row.customer_understood,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}
