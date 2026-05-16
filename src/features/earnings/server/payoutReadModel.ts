import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { parseBookingDisplay, formatScheduleRange } from "@/features/dashboards/server/parseBookingDisplay";
import type { PayoutQueueItem, CleanerEarningListItem } from "./types";

export type AdminPayoutSummary = {
  pendingCents: number;
  payoutReadyCents: number;
  paidCents: number;
  queue: PayoutQueueItem[];
};

export async function listCleanerEarnings(
  user: CurrentUser,
): Promise<
  | { ok: true; earnings: CleanerEarningListItem[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "cleaner") {
    return { ok: false, code: "FORBIDDEN", message: "Cleaners only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const scope = await resolveActorScope(client, user.profileId, user.role);
  if (!scope.actingCleanerId) {
    return { ok: false, code: "FORBIDDEN", message: "Cleaner profile not linked.", status: 403 };
  }

  const { data: lines, error } = await client
    .from("earning_lines")
    .select("*")
    .eq("cleaner_id", scope.actingCleanerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  const earnings: CleanerEarningListItem[] = [];
  for (const line of lines ?? []) {
    let serviceLabel = "Cleaning job";
    let scheduleLabel = "—";
    if (line.booking_id) {
      const { data: booking } = await client
        .from("bookings")
        .select("metadata, scheduled_start, scheduled_end")
        .eq("id", line.booking_id)
        .maybeSingle();
      if (booking) {
        const display = parseBookingDisplay(booking.metadata);
        serviceLabel = display.serviceLabel;
        scheduleLabel = formatScheduleRange(
          booking.scheduled_start,
          booking.scheduled_end,
        );
      }
    }
    earnings.push({
      id: line.id,
      bookingId: line.booking_id,
      grossAmountCents: line.gross_amount_cents,
      payoutAmountCents: line.payout_amount_cents,
      payoutStatus: line.payout_status,
      serviceLabel,
      scheduleLabel,
      createdAt: line.created_at,
    });
  }

  return { ok: true, earnings };
}

export async function getAdminPayoutSummary(
  user: CurrentUser,
): Promise<
  | { ok: true; summary: AdminPayoutSummary }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const { data: lines, error } = await client.from("earning_lines").select("*").limit(500);
  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message, status: 500 };
  }

  let pendingCents = 0;
  let payoutReadyCents = 0;
  let paidCents = 0;
  const bookingIds = new Set<string>();

  for (const line of lines ?? []) {
    if (line.payout_status === "pending") pendingCents += line.payout_amount_cents;
    if (line.payout_status === "payout_ready") payoutReadyCents += line.payout_amount_cents;
    if (line.payout_status === "paid") paidCents += line.payout_amount_cents;
    if (line.booking_id) bookingIds.add(line.booking_id);
  }

  const { data: bookings } = await client
    .from("bookings")
    .select("id, status, customer_id, scheduled_start, scheduled_end, metadata, updated_at")
    .in("status", ["completed", "payout_ready"])
    .order("updated_at", { ascending: false })
    .limit(50);

  const queue: PayoutQueueItem[] = [];
  for (const row of bookings ?? []) {
    const bookingLines = (lines ?? []).filter((l) => l.booking_id === row.id);
    if (bookingLines.length === 0) continue;
    const display = parseBookingDisplay(row.metadata);
    const { data: customer } = await client
      .from("customers")
      .select("company_name")
      .eq("id", row.customer_id)
      .maybeSingle();
    queue.push({
      bookingId: row.id,
      customerLabel: customer?.company_name?.trim() || `Customer ${row.customer_id.slice(0, 8)}`,
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      grossAmountCents: bookingLines[0]!.gross_amount_cents,
      payoutAmountCents: bookingLines.reduce((s, l) => s + l.payout_amount_cents, 0),
      earningCount: bookingLines.length,
      updatedAt: row.updated_at,
    });
  }

  return {
    ok: true,
    summary: { pendingCents, payoutReadyCents, paidCents, queue },
  };
}
