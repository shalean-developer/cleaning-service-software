import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  cleanupPhase2Run,
  createUserScopedClient,
  ensurePhase2CustomerRow,
  phase2RunId,
  provisionPhase2AuthUser,
  resolveRlsIntegrationGate,
  runRlsPreflight,
  signInAs,
} from "./rlsTestSupport";

const gate = resolveRlsIntegrationGate();

function logSkip(reason: string): void {
  console.warn(`[rls integration] skipped: ${reason}`);
}

describe("RLS role security (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let anonClient: SupabaseClient<Database> | null = null;
  let supabaseUrl = "";
  let supabaseAnonKey = "";
  let runId = "";

  let customerAEmail = "";
  let customerBEmail = "";
  let cleanerEmail = "";
  let adminEmail = "";

  let customerAId = "";
  let customerBId = "";
  let cleanerId = "";

  let bookingAId = "";
  let bookingBId = "";
  let offerId = "";

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "RLS preflight did not complete.");
  }

  beforeAll(async () => {
    if (!gate.shouldRun) {
      logSkip(skipReason);
      return;
    }

    const preflight = await runRlsPreflight(gate.url, gate.serviceRoleKey);
    if (!preflight.shouldRun) {
      skipReason = preflight.skipReason;
      logSkip(skipReason);
      return;
    }

    serviceClient = preflight.serviceClient;
    supabaseUrl = gate.url;
    supabaseAnonKey = gate.anonKey;
    anonClient = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    runId = phase2RunId();

    const customerA = await provisionPhase2AuthUser(serviceClient, `cust_a_${runId}`, "customer");
    const customerB = await provisionPhase2AuthUser(serviceClient, `cust_b_${runId}`, "customer");
    const cleaner = await provisionPhase2AuthUser(serviceClient, `cleaner_${runId}`, "cleaner");
    const admin = await provisionPhase2AuthUser(serviceClient, `admin_${runId}`, "admin");

    customerAEmail = customerA.email;
    customerBEmail = customerB.email;
    cleanerEmail = cleaner.email;
    adminEmail = admin.email;

    customerAId = await ensurePhase2CustomerRow(
      serviceClient,
      customerA.profileId,
      `${runId}_customer_a`,
    );
    customerBId = await ensurePhase2CustomerRow(
      serviceClient,
      customerB.profileId,
      `${runId}_customer_b`,
    );

    const { data: cleanerRow, error: cleanerErr } = await serviceClient
      .from("cleaners")
      .insert({
        profile_id: cleaner.profileId,
        phone: `${runId}_cleaner`,
      })
      .select("id")
      .single();
    if (cleanerErr) throw new Error(cleanerErr.message);
    cleanerId = cleanerRow.id;

    const scheduleStart = new Date().toISOString();
    const scheduleEnd = new Date(Date.now() + 3_600_000).toISOString();

    const { data: bookingA, error: bookAErr } = await serviceClient
      .from("bookings")
      .insert({
        customer_id: customerAId,
        status: "draft",
        scheduled_start: scheduleStart,
        scheduled_end: scheduleEnd,
        price_cents: 10_000,
        metadata: { test_phase2_run_id: runId },
      })
      .select("id")
      .single();
    if (bookAErr) throw new Error(bookAErr.message);
    bookingAId = bookingA.id;

    const { data: bookingB, error: bookBErr } = await serviceClient
      .from("bookings")
      .insert({
        customer_id: customerBId,
        status: "draft",
        scheduled_start: scheduleStart,
        scheduled_end: scheduleEnd,
        price_cents: 11_000,
        metadata: { test_phase2_run_id: runId },
      })
      .select("id")
      .single();
    if (bookBErr) throw new Error(bookBErr.message);
    bookingBId = bookingB.id;

    const { data: offer, error: offerErr } = await serviceClient
      .from("assignment_offers")
      .insert({
        booking_id: bookingAId,
        cleaner_id: cleanerId,
        status: "offered",
      })
      .select("id")
      .single();
    if (offerErr) throw new Error(offerErr.message);
    offerId = offer.id;

    const { data: payment, error: payErr } = await serviceClient
      .from("payments")
      .insert({
        booking_id: bookingAId,
        status: "initialized",
        idempotency_key: `${runId}_payment`,
        amount_cents: 10_000,
      })
      .select("id")
      .single();
    if (payErr) throw new Error(payErr.message);

    await serviceClient.from("payment_events").insert({
      payment_id: payment.id,
      provider_event_id: `${runId}_evt`,
      event_type: "test",
    });

    ready = true;
  });

  afterAll(async () => {
    if (!ready || !serviceClient) return;
    await cleanupPhase2Run(serviceClient, runId);
  });

  it("customer cannot read another customer booking", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, customerAEmail);

    const { data, error } = await client.from("bookings").select("id").eq("id", bookingBId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cleaner cannot read unrelated booking", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, cleanerEmail);

    const { data, error } = await client.from("bookings").select("id").eq("id", bookingBId);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cleaner can read offered booking", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, cleanerEmail);

    const { data, error } = await client.from("bookings").select("id").eq("id", bookingAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("customer cannot update bookings.status", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, customerAEmail);

    const { error } = await client
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", bookingAId);

    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/BOOKING_STATUS_MUTATION_FORBIDDEN/i);
  });

  it("anon cannot read private bookings or payments", async (ctx) => {
    skipUnlessReady(ctx);
    const client = anonClient!;

    const bookings = await client.from("bookings").select("id").limit(1);
    expect(bookings.error).toBeNull();
    expect(bookings.data ?? []).toHaveLength(0);

    const payments = await client.from("payments").select("id").limit(1);
    expect(payments.error).toBeNull();
    expect(payments.data ?? []).toHaveLength(0);
  });

  it("admin can access operational data", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, adminEmail);

    const bookings = await client.from("bookings").select("id").eq("id", bookingAId);
    expect(bookings.error).toBeNull();
    expect(bookings.data).toHaveLength(1);

    const payments = await client.from("payments").select("id").limit(5);
    expect(payments.error).toBeNull();
    expect((payments.data ?? []).length).toBeGreaterThan(0);

    const outbox = await client.from("notification_outbox").select("id").limit(1);
    expect(outbox.error).toBeNull();
  });

  it("cleaner can update offer response fields only", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, cleanerEmail);

    const declined = await client
      .from("assignment_offers")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", offerId);
    expect(declined.error).toBeNull();

    const tamper = await client
      .from("assignment_offers")
      .update({ booking_id: bookingBId })
      .eq("id", offerId);
    expect(tamper.error).not.toBeNull();
    expect(tamper.error?.message ?? "").toMatch(/ASSIGNMENT_OFFER_FIELD_MUTATION_FORBIDDEN/i);
  });

  it("service role can execute booking command RPC", async (ctx) => {
    skipUnlessReady(ctx);

    const { data: pendingBooking, error: pendingErr } = await serviceClient!
      .from("bookings")
      .update({ status: "pending_payment" })
      .eq("id", bookingAId)
      .select("id")
      .single();
    expect(pendingErr).toBeNull();
    expect(pendingBooking?.id).toBe(bookingAId);

    const { data: payment } = await serviceClient!
      .from("payments")
      .select("id")
      .eq("booking_id", bookingAId)
      .single();

    const { data: rpcResult, error: rpcErr } = await serviceClient!.rpc(
      "booking_finalize_payment_success",
      {
        p_booking_id: bookingAId,
        p_payment_id: payment!.id,
        p_idempotency_key: `${runId}_finalize`,
        p_command: "FINALIZE_PAYMENT_SUCCESS",
        p_actor_profile_id: null,
        p_actor_type: "system",
        p_reason: "rls integration test",
        p_metadata: {},
      },
    );

    expect(rpcErr).toBeNull();
    expect(rpcResult).toBeTruthy();
  });
});
