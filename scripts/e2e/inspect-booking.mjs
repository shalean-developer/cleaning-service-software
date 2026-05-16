#!/usr/bin/env node
/**
 * Print lifecycle snapshot for a booking (service role).
 * Usage: npm run e2e:inspect:booking -- <bookingId>
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "./lib/env.mjs";

const bookingId = process.argv[2];
if (!bookingId) {
  console.error("Usage: node scripts/e2e/inspect-booking.mjs <bookingId>");
  process.exit(1);
}

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function main() {
  const { data: booking, error } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking) {
    console.error("Booking not found:", bookingId);
    process.exit(1);
  }

  const { data: payments } = await client.from("payments").select("*").eq("booking_id", bookingId);
  const { data: offers } = await client
    .from("assignment_offers")
    .select("*")
    .eq("booking_id", bookingId)
    .order("offered_at", { ascending: false });
  const { data: audits } = await client
    .from("booking_state_audit")
    .select("id, command, from_status, to_status, created_at, idempotency_key")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  const { data: earnings } = await client
    .from("earning_lines")
    .select("*")
    .eq("booking_id", bookingId);

  console.log(JSON.stringify(
    {
      booking: {
        id: booking.id,
        status: booking.status,
        customer_id: booking.customer_id,
        cleaner_id: booking.cleaner_id,
        price_cents: booking.price_cents,
        currency: booking.currency,
        scheduled_start: booking.scheduled_start,
        scheduled_end: booking.scheduled_end,
        updated_at: booking.updated_at,
      },
      payments: (payments ?? []).map((p) => ({
        id: p.id,
        status: p.status,
        amount_cents: p.amount_cents,
        provider_ref: p.provider_ref,
        idempotency_key: p.idempotency_key,
      })),
      offers: (offers ?? []).map((o) => ({
        id: o.id,
        cleaner_id: o.cleaner_id,
        status: o.status,
        expires_at: o.expires_at,
      })),
      audits: audits ?? [],
      earnings: (earnings ?? []).map((e) => ({
        id: e.id,
        cleaner_id: e.cleaner_id,
        payout_amount_cents: e.payout_amount_cents,
        payout_status: e.payout_status,
        line_type: e.line_type,
      })),
    },
    null,
    2,
  ));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
