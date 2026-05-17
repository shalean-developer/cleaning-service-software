import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  cleanupPhase2Run,
  createUserScopedClient,
  ensurePhase2CustomerRow,
  phase2RunId,
  provisionPhase2AuthUser,
  isAssignmentOffersRlsPhase3cApplied,
  isBookingsRlsPhase4Applied,
  isEarningLinesRlsPhase3bApplied,
  isPaymentEventsRlsPhase4Applied,
  isPaymentsRlsPhase1Applied,
  ASSIGNMENT_OFFERS_PHASE3C_SKIP,
  BOOKINGS_PHASE4_SKIP,
  EARNING_LINES_PHASE3B_SKIP,
  PAYMENT_EVENTS_PHASE4_SKIP,
  PAYMENTS_PHASE1_SKIP,
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
  let offerBId = "";
  let offerDeleteProbeId = "";
  let assignmentOffersPhase3cApplied = false;
  let paymentAId = "";
  let paymentBId = "";
  let paymentDeleteProbeId = "";
  let paymentsPhase1Applied = false;
  let paymentEventAId = "";
  let paymentEventDeleteProbeId = "";
  let paymentEventsPhase4Applied = false;
  let bookingDeleteProbeId = "";
  let bookingsPhase4Applied = false;

  let cleanerBId = "";
  let earningLineAId = "";
  let earningLineBId = "";
  let earningLineDeleteProbeId = "";
  let earningLinesPhase3bApplied = false;

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "RLS preflight did not complete.");
  }

  function skipUnlessPaymentsPhase1(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!paymentsPhase1Applied) ctx.skip(PAYMENTS_PHASE1_SKIP);
  }

  function skipUnlessEarningLinesPhase3b(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!earningLinesPhase3bApplied) ctx.skip(EARNING_LINES_PHASE3B_SKIP);
  }

  function skipUnlessAssignmentOffersPhase3c(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!assignmentOffersPhase3cApplied) ctx.skip(ASSIGNMENT_OFFERS_PHASE3C_SKIP);
  }

  function skipUnlessPaymentEventsPhase4(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!paymentEventsPhase4Applied) ctx.skip(PAYMENT_EVENTS_PHASE4_SKIP);
  }

  function skipUnlessBookingsPhase4(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!bookingsPhase4Applied) ctx.skip(BOOKINGS_PHASE4_SKIP);
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
    paymentAId = payment.id;

    const { data: paymentB, error: payBErr } = await serviceClient
      .from("payments")
      .insert({
        booking_id: bookingBId,
        status: "initialized",
        idempotency_key: `${runId}_payment_b`,
        amount_cents: 11_000,
      })
      .select("id")
      .single();
    if (payBErr) throw new Error(payBErr.message);
    paymentBId = paymentB.id;

    const { data: deleteProbePayment, error: deleteProbeErr } = await serviceClient
      .from("payments")
      .insert({
        booking_id: bookingAId,
        status: "initialized",
        idempotency_key: `${runId}_payment_delete_probe`,
        amount_cents: 10_000,
      })
      .select("id")
      .single();
    if (deleteProbeErr) throw new Error(deleteProbeErr.message);
    paymentDeleteProbeId = deleteProbePayment.id;

    const adminProbeClient = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(adminProbeClient, adminEmail);
    paymentsPhase1Applied = await isPaymentsRlsPhase1Applied(
      serviceClient,
      adminProbeClient,
      paymentAId,
    );

    const cleanerB = await provisionPhase2AuthUser(serviceClient, `cleaner_b_${runId}`, "cleaner");
    const { data: cleanerBRow, error: cleanerBErr } = await serviceClient
      .from("cleaners")
      .insert({
        profile_id: cleanerB.profileId,
        phone: `${runId}_cleaner_b`,
      })
      .select("id")
      .single();
    if (cleanerBErr) throw new Error(cleanerBErr.message);
    cleanerBId = cleanerBRow.id;

    const { data: offerB, error: offerBErr } = await serviceClient
      .from("assignment_offers")
      .insert({
        booking_id: bookingBId,
        cleaner_id: cleanerBId,
        status: "offered",
      })
      .select("id")
      .single();
    if (offerBErr) throw new Error(offerBErr.message);
    offerBId = offerB.id;

    const { data: offerDeleteProbe, error: offerDeleteProbeErr } = await serviceClient
      .from("assignment_offers")
      .insert({
        booking_id: bookingAId,
        cleaner_id: cleanerBId,
        status: "declined",
      })
      .select("id")
      .single();
    if (offerDeleteProbeErr) throw new Error(offerDeleteProbeErr.message);
    offerDeleteProbeId = offerDeleteProbe.id;

    const earningInsert = {
      amount_cents: 5_000,
      gross_amount_cents: 10_000,
      payout_amount_cents: 5_000,
      payout_status: "pending" as const,
      line_type: "booking_completion",
      description: "RLS test earnings",
      metadata: { test_phase2_run_id: runId },
      calculation_metadata: {},
    };

    const { data: earningA, error: earningAErr } = await serviceClient
      .from("earning_lines")
      .insert({
        ...earningInsert,
        cleaner_id: cleanerId,
        booking_id: bookingAId,
      })
      .select("id")
      .single();
    if (earningAErr) throw new Error(earningAErr.message);
    earningLineAId = earningA.id;

    const { data: earningB, error: earningBErr } = await serviceClient
      .from("earning_lines")
      .insert({
        ...earningInsert,
        cleaner_id: cleanerBId,
        booking_id: bookingBId,
      })
      .select("id")
      .single();
    if (earningBErr) throw new Error(earningBErr.message);
    earningLineBId = earningB.id;

    const { data: earningDeleteProbe, error: earningDeleteErr } = await serviceClient
      .from("earning_lines")
      .insert({
        ...earningInsert,
        cleaner_id: cleanerId,
        booking_id: bookingAId,
        line_type: "rls_delete_probe",
        payout_amount_cents: 5_001,
        amount_cents: 5_001,
      })
      .select("id")
      .single();
    if (earningDeleteErr) throw new Error(earningDeleteErr.message);
    earningLineDeleteProbeId = earningDeleteProbe.id;

    earningLinesPhase3bApplied = await isEarningLinesRlsPhase3bApplied(
      serviceClient,
      adminProbeClient,
      earningLineAId,
    );

    assignmentOffersPhase3cApplied = await isAssignmentOffersRlsPhase3cApplied(
      serviceClient,
      adminProbeClient,
      offerId,
    );

    const { data: paymentEventA, error: paymentEventAErr } = await serviceClient
      .from("payment_events")
      .insert({
        payment_id: payment.id,
        provider_event_id: `${runId}_evt`,
        event_type: "test",
        payload: {},
      })
      .select("id")
      .single();
    if (paymentEventAErr) throw new Error(paymentEventAErr.message);
    paymentEventAId = paymentEventA.id;

    const { data: paymentEventDeleteProbe, error: paymentEventDeleteErr } =
      await serviceClient
        .from("payment_events")
        .insert({
          payment_id: payment.id,
          provider_event_id: `${runId}_evt_delete_probe`,
          event_type: "test",
          payload: {},
        })
        .select("id")
        .single();
    if (paymentEventDeleteErr) throw new Error(paymentEventDeleteErr.message);
    paymentEventDeleteProbeId = paymentEventDeleteProbe.id;

    const { data: bookingDeleteProbe, error: bookingDeleteProbeErr } = await serviceClient
      .from("bookings")
      .insert({
        customer_id: customerAId,
        status: "draft",
        scheduled_start: scheduleStart,
        scheduled_end: scheduleEnd,
        price_cents: 1,
        metadata: { test_phase2_run_id: runId, rls_delete_probe: true },
      })
      .select("id")
      .single();
    if (bookingDeleteProbeErr) throw new Error(bookingDeleteProbeErr.message);
    bookingDeleteProbeId = bookingDeleteProbe.id;

    paymentEventsPhase4Applied = await isPaymentEventsRlsPhase4Applied(
      serviceClient,
      adminProbeClient,
      paymentAId,
    );

    bookingsPhase4Applied = await isBookingsRlsPhase4Applied(
      serviceClient,
      adminProbeClient,
      bookingAId,
    );

    ready = true;
  }, 30_000);

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

  describe("assignment_offers RLS phase 3c (5B-3c-a)", () => {
    it("admin can SELECT assignment_offers", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("assignment_offers")
        .select("id, status")
        .eq("id", offerId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("admin cannot INSERT assignment_offers", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client.from("assignment_offers").insert({
        booking_id: bookingAId,
        cleaner_id: cleanerId,
        status: "offered",
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("admin cannot UPDATE assignment_offers.status", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const before = await client
        .from("assignment_offers")
        .select("status")
        .eq("id", offerId)
        .single();
      expect(before.error).toBeNull();

      const { data, error } = await client
        .from("assignment_offers")
        .update({ status: "accepted" })
        .eq("id", offerId)
        .select("status");

      const after = await client
        .from("assignment_offers")
        .select("status")
        .eq("id", offerId)
        .single();
      expect(after.error).toBeNull();
      expect(after.data?.status).toBe(before.data?.status);
      expect(after.data?.status).not.toBe("accepted");

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("admin cannot DELETE assignment_offers", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("assignment_offers")
        .delete()
        .eq("id", offerDeleteProbeId)
        .select("id");

      const stillThere = await serviceClient!
        .from("assignment_offers")
        .select("id")
        .eq("id", offerDeleteProbeId)
        .single();
      expect(stillThere.error).toBeNull();
      expect(stillThere.data?.id).toBe(offerDeleteProbeId);

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("cleaner can SELECT own assignment_offers", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, cleanerEmail);

      const { data, error } = await client
        .from("assignment_offers")
        .select("id")
        .eq("id", offerId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("cleaner cannot SELECT another cleaner assignment_offers", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, cleanerEmail);

      const { data, error } = await client
        .from("assignment_offers")
        .select("id")
        .eq("id", offerBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("customer can SELECT offers on own booking", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("assignment_offers")
        .select("id")
        .eq("booking_id", bookingAId);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });

    it("customer cannot SELECT offers on another customer booking", async (ctx) => {
      skipUnlessAssignmentOffersPhase3c(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("assignment_offers")
        .select("id")
        .eq("booking_id", bookingBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
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

  describe("payments RLS phase 1 (5B-3a)", () => {
    it("admin can SELECT payments", async (ctx) => {
      skipUnlessPaymentsPhase1(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("payments")
        .select("id, status")
        .eq("id", paymentAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("admin cannot INSERT payments", async (ctx) => {
      skipUnlessPaymentsPhase1(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client.from("payments").insert({
        booking_id: bookingAId,
        status: "initialized",
        idempotency_key: `${runId}_admin_insert_blocked`,
        amount_cents: 1,
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("admin cannot UPDATE payments.status", async (ctx) => {
      skipUnlessPaymentsPhase1(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const before = await client
        .from("payments")
        .select("status")
        .eq("id", paymentAId)
        .single();
      expect(before.error).toBeNull();

      const { data, error } = await client
        .from("payments")
        .update({ status: "paid" })
        .eq("id", paymentAId)
        .select("status");

      const after = await client
        .from("payments")
        .select("status")
        .eq("id", paymentAId)
        .single();
      expect(after.error).toBeNull();
      expect(after.data?.status).toBe(before.data?.status);
      expect(after.data?.status).not.toBe("paid");

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("admin cannot DELETE payments", async (ctx) => {
      skipUnlessPaymentsPhase1(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("payments")
        .delete()
        .eq("id", paymentDeleteProbeId)
        .select("id");

      const stillThere = await serviceClient!
        .from("payments")
        .select("id")
        .eq("id", paymentDeleteProbeId)
        .single();
      expect(stillThere.error).toBeNull();
      expect(stillThere.data?.id).toBe(paymentDeleteProbeId);

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("customer can SELECT own payment", async (ctx) => {
      skipUnlessPaymentsPhase1(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("payments")
        .select("id")
        .eq("id", paymentAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("customer cannot SELECT another customer payment", async (ctx) => {
      skipUnlessPaymentsPhase1(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("payments")
        .select("id")
        .eq("booking_id", bookingBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("earning_lines RLS phase 3b (5B-3b-a)", () => {
    it("admin can SELECT earning_lines", async (ctx) => {
      skipUnlessEarningLinesPhase3b(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("earning_lines")
        .select("id, payout_status")
        .eq("id", earningLineAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("admin cannot INSERT earning_lines", async (ctx) => {
      skipUnlessEarningLinesPhase3b(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client.from("earning_lines").insert({
        cleaner_id: cleanerId,
        booking_id: bookingAId,
        amount_cents: 100,
        gross_amount_cents: 100,
        payout_amount_cents: 100,
        payout_status: "pending",
        line_type: "admin_insert_blocked",
        description: "blocked",
        metadata: {},
        calculation_metadata: {},
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("admin cannot UPDATE payout_status", async (ctx) => {
      skipUnlessEarningLinesPhase3b(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const before = await client
        .from("earning_lines")
        .select("payout_status")
        .eq("id", earningLineAId)
        .single();
      expect(before.error).toBeNull();

      const { data, error } = await client
        .from("earning_lines")
        .update({ payout_status: "paid" })
        .eq("id", earningLineAId)
        .select("payout_status");

      const after = await client
        .from("earning_lines")
        .select("payout_status")
        .eq("id", earningLineAId)
        .single();
      expect(after.error).toBeNull();
      expect(after.data?.payout_status).toBe(before.data?.payout_status);
      expect(after.data?.payout_status).not.toBe("paid");

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("admin cannot DELETE earning_lines", async (ctx) => {
      skipUnlessEarningLinesPhase3b(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("earning_lines")
        .delete()
        .eq("id", earningLineDeleteProbeId)
        .select("id");

      const stillThere = await serviceClient!
        .from("earning_lines")
        .select("id")
        .eq("id", earningLineDeleteProbeId)
        .single();
      expect(stillThere.error).toBeNull();
      expect(stillThere.data?.id).toBe(earningLineDeleteProbeId);

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("cleaner can SELECT own earning_lines", async (ctx) => {
      skipUnlessEarningLinesPhase3b(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, cleanerEmail);

      const { data, error } = await client
        .from("earning_lines")
        .select("id")
        .eq("id", earningLineAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("cleaner cannot SELECT another cleaner earning_lines", async (ctx) => {
      skipUnlessEarningLinesPhase3b(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, cleanerEmail);

      const { data, error } = await client
        .from("earning_lines")
        .select("id")
        .eq("id", earningLineBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });

    it("customer cannot SELECT earning_lines", async (ctx) => {
      skipUnlessEarningLinesPhase3b(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("earning_lines")
        .select("id")
        .eq("booking_id", bookingAId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("payment_events RLS phase 4a (5B-3)", () => {
    it("admin can SELECT payment_events", async (ctx) => {
      skipUnlessPaymentEventsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("payment_events")
        .select("id, event_type")
        .eq("id", paymentEventAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("admin cannot INSERT payment_events", async (ctx) => {
      skipUnlessPaymentEventsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("payment_events")
        .insert({
          payment_id: paymentAId,
          provider_event_id: `${runId}_admin_evt_blocked`,
          event_type: "blocked",
          payload: {},
        })
        .select("id");

      expect(data ?? []).toHaveLength(0);
      expect(error).not.toBeNull();
    });

    it("admin cannot UPDATE payment_events", async (ctx) => {
      skipUnlessPaymentEventsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const before = await client
        .from("payment_events")
        .select("event_type")
        .eq("id", paymentEventAId)
        .single();
      expect(before.error).toBeNull();

      const { data, error } = await client
        .from("payment_events")
        .update({ event_type: "tampered" })
        .eq("id", paymentEventAId)
        .select("event_type");

      const after = await client
        .from("payment_events")
        .select("event_type")
        .eq("id", paymentEventAId)
        .single();
      expect(after.error).toBeNull();
      expect(after.data?.event_type).toBe(before.data?.event_type);
      expect(after.data?.event_type).not.toBe("tampered");

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("admin cannot DELETE payment_events", async (ctx) => {
      skipUnlessPaymentEventsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("payment_events")
        .delete()
        .eq("id", paymentEventDeleteProbeId)
        .select("id");

      const stillThere = await serviceClient!
        .from("payment_events")
        .select("id")
        .eq("id", paymentEventDeleteProbeId)
        .single();
      expect(stillThere.error).toBeNull();
      expect(stillThere.data?.id).toBe(paymentEventDeleteProbeId);

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("customer can SELECT payment_events for own payment", async (ctx) => {
      skipUnlessPaymentEventsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("payment_events")
        .select("id")
        .eq("payment_id", paymentAId);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });

    it("customer cannot SELECT payment_events for another customer payment", async (ctx) => {
      skipUnlessPaymentEventsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("payment_events")
        .select("id")
        .eq("payment_id", paymentBId);
      expect(error).toBeNull();
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("bookings RLS phase 4a (5B-3)", () => {
    it("admin can SELECT bookings", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("bookings")
        .select("id, status")
        .eq("id", bookingAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("admin cannot INSERT bookings", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client.from("bookings").insert({
        customer_id: customerAId,
        status: "draft",
        scheduled_start: new Date().toISOString(),
        scheduled_end: new Date(Date.now() + 3_600_000).toISOString(),
        price_cents: 1,
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
    });

    it("admin cannot UPDATE bookings.status", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const before = await client
        .from("bookings")
        .select("status")
        .eq("id", bookingAId)
        .single();
      expect(before.error).toBeNull();

      const { data, error } = await client
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingAId)
        .select("status");

      const after = await client
        .from("bookings")
        .select("status")
        .eq("id", bookingAId)
        .single();
      expect(after.error).toBeNull();
      expect(after.data?.status).toBe(before.data?.status);
      expect(after.data?.status).not.toBe("confirmed");

      if (error) {
        expect(error.message ?? "").toMatch(
          /BOOKING_STATUS_MUTATION_FORBIDDEN|row-level security|permission denied|42501/i,
        );
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("admin cannot UPDATE bookings.price_cents", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const before = await client
        .from("bookings")
        .select("price_cents")
        .eq("id", bookingAId)
        .single();
      expect(before.error).toBeNull();

      const { data, error } = await client
        .from("bookings")
        .update({ price_cents: 99_999 })
        .eq("id", bookingAId)
        .select("price_cents");

      const after = await client
        .from("bookings")
        .select("price_cents")
        .eq("id", bookingAId)
        .single();
      expect(after.error).toBeNull();
      expect(after.data?.price_cents).toBe(before.data?.price_cents);
      expect(after.data?.price_cents).not.toBe(99_999);

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("admin cannot UPDATE bookings.metadata or cleaner_id", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const meta = await client
        .from("bookings")
        .update({ metadata: { admin_tamper: true } })
        .eq("id", bookingAId)
        .select("id");
      if (meta.error) {
        expect(meta.error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(meta.data ?? []).toHaveLength(0);
      }

      const cleaner = await client
        .from("bookings")
        .update({ cleaner_id: cleanerBId })
        .eq("id", bookingAId)
        .select("id");
      if (cleaner.error) {
        expect(cleaner.error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(cleaner.data ?? []).toHaveLength(0);
      }
    });

    it("admin cannot DELETE bookings", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, adminEmail);

      const { data, error } = await client
        .from("bookings")
        .delete()
        .eq("id", bookingDeleteProbeId)
        .select("id");

      const stillThere = await serviceClient!
        .from("bookings")
        .select("id")
        .eq("id", bookingDeleteProbeId)
        .single();
      expect(stillThere.error).toBeNull();
      expect(stillThere.data?.id).toBe(bookingDeleteProbeId);

      if (error) {
        expect(error.message ?? "").toMatch(/row-level security|permission denied|42501/i);
      } else {
        expect(data ?? []).toHaveLength(0);
      }
    });

    it("customer can SELECT own booking", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const { data, error } = await client
        .from("bookings")
        .select("id")
        .eq("id", bookingAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("cleaner can SELECT offered booking", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, cleanerEmail);

      const { data, error } = await client
        .from("bookings")
        .select("id")
        .eq("id", bookingAId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("customer can UPDATE own booking metadata but not status", async (ctx) => {
      skipUnlessBookingsPhase4(ctx);
      const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
      await signInAs(client, customerAEmail);

      const meta = await client
        .from("bookings")
        .update({ metadata: { customer_patch: runId } })
        .eq("id", bookingAId);
      expect(meta.error).toBeNull();

      const status = await client
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", bookingAId);
      expect(status.error).not.toBeNull();
      expect(status.error?.message ?? "").toMatch(/BOOKING_STATUS_MUTATION_FORBIDDEN/i);
    });
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

    const { data: rpcResult, error: rpcErr } = await serviceClient!.rpc(
      "booking_finalize_payment_success",
      {
        p_booking_id: bookingAId,
        p_payment_id: paymentAId,
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
