#!/usr/bin/env node
/**
 * Phase 4 staging E2E: deferred assignment lifecycle against linked Supabase.
 * Usage: node scripts/ops/phase4-deferred-staging-e2e.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

function loadEnv() {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const CRON_SECRET = env.CRON_SECRET;
const APP_URL = env.APP_BASE_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const customerId = env.E2E_TEST_CUSTOMER_ID;
const cleanerId = env.E2E_TEST_CLEANER_ID;

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LEAD_DAYS = 14;
const RUN_TAG = `phase4-deferred-${Date.now()}`;

function computeDispatchAt(scheduledStartIso) {
  const startMs = Date.parse(scheduledStartIso);
  return new Date(startMs - LEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function cleanupBooking(bookingId) {
  if (!bookingId) return;
  await client.from("assignment_offers").delete().eq("booking_id", bookingId);
  await client.from("payments").delete().eq("booking_id", bookingId);
  await client.from("booking_locks").delete().eq("booking_id", bookingId);
  await client.from("booking_state_audit").delete().eq("booking_id", bookingId);
  await client.from("bookings").delete().eq("id", bookingId);
}

async function createDeferredBooking() {
  const scheduledStart = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  scheduledStart.setUTCHours(10, 0, 0, 0);
  const scheduledEnd = new Date(scheduledStart.getTime() + 3 * 60 * 60 * 1000);
  const assignmentDispatchAt = computeDispatchAt(scheduledStart.toISOString());

  const { data: booking, error: bookErr } = await client
    .from("bookings")
    .insert({
      customer_id: customerId,
      status: "confirmed",
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      price_cents: 131005,
      currency: "ZAR",
      assignment_dispatch_at: assignmentDispatchAt,
      metadata: {
        phase4Run: RUN_TAG,
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
            frequency: "once",
            teamSize: 1,
            requestedTeamSize: 1,
          },
        },
        areaSlug: "cape-town",
        cleanerPreferenceMode: "best_available",
      },
    })
    .select("id, status, assignment_dispatch_at, scheduled_start")
    .single();
  if (bookErr) throw bookErr;

  const lockMeta = {
    areaSlug: "cape-town",
    quote: {
      input: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        frequency: "once",
        teamSize: 1,
        requestedTeamSize: 1,
      },
    },
    cleanerPreferenceMode: "best_available",
  };

  const lockedAt = new Date();
  const expiresAt = new Date(lockedAt.getTime() + 30 * 60 * 1000);

  const { error: lockErr } = await client.from("booking_locks").insert({
    booking_id: booking.id,
    customer_id: customerId,
    idempotency_key: `phase4:${RUN_TAG}`,
    status: "consumed",
    locked_at: lockedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    locked_price_cents: 131005,
    locked_currency: "ZAR",
    locked_service_slug: "regular-cleaning",
    locked_schedule_start: scheduledStart.toISOString(),
    locked_schedule_end: scheduledEnd.toISOString(),
    locked_schedule_timezone: "Africa/Johannesburg",
    locked_area_slug: "cape-town",
    locked_cleaner_preference: { mode: "best_available", selectedCleanerId: null },
    locked_metadata: lockMeta,
    client_quote_total_cents: 131005,
    inputs_hash: RUN_TAG,
  });
  if (lockErr) throw lockErr;

  const { error: payErr } = await client.from("payments").insert({
    booking_id: booking.id,
    status: "paid",
    amount_cents: 131005,
    currency: "ZAR",
    provider: "paystack",
    provider_ref: `phase4-${RUN_TAG}`,
    idempotency_key: `phase4-pay-${RUN_TAG}`,
  });
  if (payErr) throw payErr;

  return { booking, assignmentDispatchAt };
}

async function countOffers(bookingId) {
  const { count } = await client
    .from("assignment_offers")
    .select("*", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("status", "offered");
  return count ?? 0;
}

async function invokeCron(label) {
  const res = await fetch(`${APP_URL}/api/cron/dispatch-deferred-assignments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      "Content-Type": "application/json",
      "x-cron-invoke-source": label === "manual" ? "manual" : "cron",
    },
    body: "{}",
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const report = {
    runTag: RUN_TAG,
    appUrl: APP_URL,
    cleanerId,
    customerId,
    steps: [],
  };

  let bookingId;
  try {
    const { booking, assignmentDispatchAt } = await createDeferredBooking();
    bookingId = booking.id;
    const offersBefore = await countOffers(bookingId);

    report.bookingId = bookingId;
    report.assignmentDispatchAt = assignmentDispatchAt;
    report.steps.push({
      phase: "deferred_created",
      status: booking.status,
      offersBefore,
      pass: booking.status === "confirmed" && offersBefore === 0,
    });

    const noAuth = await fetch(`${APP_URL}/api/cron/dispatch-deferred-assignments`, {
      method: "POST",
    });
    report.steps.push({
      phase: "cron_unauthorized",
      status: noAuth.status,
      pass: noAuth.status === 401,
    });

    const cronBeforeWindow = await invokeCron("manual");
    report.steps.push({
      phase: "cron_before_window",
      httpStatus: cronBeforeWindow.status,
      body: cronBeforeWindow.body,
      pass:
        cronBeforeWindow.status === 200 &&
        !cronBeforeWindow.body.dispatchedBookingIds?.includes(bookingId),
    });

    const pastDispatch = new Date(Date.now() - 60_000).toISOString();
    await client
      .from("bookings")
      .update({ assignment_dispatch_at: pastDispatch })
      .eq("id", bookingId);

    const cron1 = await invokeCron("manual");
    const offersAfter1 = await countOffers(bookingId);
    const { data: bookingAfter1 } = await client
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();

    report.steps.push({
      phase: "cron_after_window_first",
      httpStatus: cron1.status,
      body: cron1.body,
      bookingStatus: bookingAfter1?.status,
      offersAfter: offersAfter1,
      pass:
        cron1.status === 200 &&
        (cron1.body.dispatchedBookingIds?.includes(bookingId) ||
          offersAfter1 > 0 ||
          bookingAfter1?.status === "pending_assignment"),
    });

    const cron2 = await invokeCron("manual");
    const offersAfter2 = await countOffers(bookingId);
    report.steps.push({
      phase: "cron_idempotent_second",
      httpStatus: cron2.status,
      body: cron2.body,
      offersAfter: offersAfter2,
      pass: offersAfter2 === offersAfter1 && offersAfter2 <= 1,
    });

    const { data: cronRuns } = await client
      .from("deferred_dispatch_cron_runs")
      .select("id, trigger_source, ok, dispatched_count, completed_at")
      .order("completed_at", { ascending: false })
      .limit(3);

    report.recentCronRunIds = cronRuns?.map((r) => r.id) ?? [];
    report.pass = report.steps.every((s) => s.pass);
  } catch (e) {
    report.error =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String(e.message)
          : JSON.stringify(e);
    report.pass = false;
  } finally {
    if (bookingId && process.env.PHASE4_KEEP_BOOKING !== "true") {
      await cleanupBooking(bookingId);
      report.cleanedUp = true;
    }
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main();
