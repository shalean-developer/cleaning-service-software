import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAssistedBookingFrictionBooking } from "./adminAssistedBookingFriction";
import type { Database } from "@/lib/database/types";

export async function enrichFrictionBookingsWithRecurringMaterialization(
  client: SupabaseClient<Database>,
  bookings: AdminAssistedBookingFrictionBooking[],
): Promise<AdminAssistedBookingFrictionBooking[]> {
  const recurringIds = bookings
    .filter((b) => b.recurringCadence != null)
    .map((b) => b.bookingId);
  if (recurringIds.length === 0) return bookings;

  const [{ data: seriesRows }, { data: groupRows }] = await Promise.all([
    client
      .from("booking_series")
      .select("id, created_from_booking_id, group_id")
      .in("created_from_booking_id", recurringIds),
    client
      .from("recurring_schedule_groups")
      .select("id, anchor_booking_id")
      .in("anchor_booking_id", recurringIds),
  ]);

  const seriesByBooking = new Map(
    (seriesRows ?? []).map((row) => [row.created_from_booking_id, row]),
  );
  const groupByBooking = new Map(
    (groupRows ?? []).map((row) => [row.anchor_booking_id, row]),
  );

  return bookings.map((booking) => {
    if (!booking.recurringCadence) return booking;

    const series = seriesByBooking.get(booking.bookingId);
    const group = groupByBooking.get(booking.bookingId);
    const materialized = Boolean(series || group);

    let materializationStatus = booking.recurringMaterializationStatus;
    if (booking.status !== "draft" && booking.status !== "pending_payment") {
      materializationStatus = materialized ? "succeeded" : "pending";
    }

    return {
      ...booking,
      recurringGroupId: group?.id ?? series?.group_id ?? null,
      recurringMaterializationStatus: materializationStatus,
    };
  });
}
