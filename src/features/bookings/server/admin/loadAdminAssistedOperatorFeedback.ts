import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

import type { AdminAssistedLessonCategory, AdminAssistedLessonTag } from "./adminAssistedOperatorLessonTypes";

export type AdminAssistedOperatorFeedback = {
  id: string;
  bookingId: string;
  adminProfileId: string;
  confusingText: string | null;
  slowedDownText: string | null;
  paymentSucceeded: boolean | null;
  customerUnderstood: boolean | null;
  notes: string | null;
  lessonCategory: AdminAssistedLessonCategory | null;
  lessonTags: AdminAssistedLessonTag[];
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
  lessonCategory?: AdminAssistedLessonCategory | null;
  lessonTags?: AdminAssistedLessonTag[];
};

function trimOrNull(value: string | null | undefined, maxLen: number): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function mapFeedbackRow(row: {
  id: string;
  booking_id: string;
  admin_profile_id: string;
  confusing_text: string | null;
  slowed_down_text: string | null;
  payment_succeeded: boolean | null;
  customer_understood: boolean | null;
  notes: string | null;
  lesson_category?: string | null;
  lesson_tags?: string[] | null;
  created_at: string;
}): AdminAssistedOperatorFeedback {
  return {
    id: row.id,
    bookingId: row.booking_id,
    adminProfileId: row.admin_profile_id,
    confusingText: row.confusing_text,
    slowedDownText: row.slowed_down_text,
    paymentSucceeded: row.payment_succeeded,
    customerUnderstood: row.customer_understood,
    notes: row.notes,
    lessonCategory: (row.lesson_category as AdminAssistedLessonCategory | null) ?? null,
    lessonTags: (row.lesson_tags ?? []) as AdminAssistedLessonTag[],
    createdAt: row.created_at,
  };
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
      lesson_category: input.lessonCategory ?? null,
      lesson_tags: input.lessonTags ?? [],
    })
    .select(
      "id, booking_id, admin_profile_id, confusing_text, slowed_down_text, payment_succeeded, customer_understood, notes, lesson_category, lesson_tags, created_at",
    )
    .single();

  if (error) throw new Error(error.message);

  return mapFeedbackRow(data);
}

export async function loadAdminAssistedOperatorFeedbackForBooking(
  bookingId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedOperatorFeedback[]> {
  const { data, error } = await client
    .from("admin_assisted_operator_feedback")
    .select(
      "id, booking_id, admin_profile_id, confusing_text, slowed_down_text, payment_succeeded, customer_understood, notes, lesson_category, lesson_tags, created_at",
    )
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapFeedbackRow(row));
}

export async function loadRecentAdminAssistedOperatorFeedback(
  limit = 50,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminAssistedOperatorFeedback[]> {
  const { data, error } = await client
    .from("admin_assisted_operator_feedback")
    .select(
      "id, booking_id, admin_profile_id, confusing_text, slowed_down_text, payment_succeeded, customer_understood, notes, lesson_category, lesson_tags, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => mapFeedbackRow(row));
}
