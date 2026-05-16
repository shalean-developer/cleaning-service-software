import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { executeBookingCommand } from "./executeBookingCommand";
import {
  cleanupPhase1TestRunBookings,
  cleanupStalePhase1TestData,
  createPhase1RunId,
  getSeededIntegrationCustomerId,
  phase1BookingMetadata,
  phase1EventKey,
  phase1PaymentKey,
  provisionPhase1IntegrationCustomer,
  resolvePhase1IntegrationGate,
  runPhase1IntegrationPreflight,
} from "./phase1IntegrationTestSupport";
import { SupabaseBookingCommandBackend } from "./supabaseBookingCommandBackend";

const gate = resolvePhase1IntegrationGate();

function logIntegrationSkip(reason: string): void {
  console.warn(`[booking integration] skipped: ${reason}`);
}

describe(
  "executeBookingCommand (Supabase integration)",
  () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let client: SupabaseClient<Database> | null = null;
  let backend: SupabaseBookingCommandBackend | null = null;
  let customerId = "";
  let runId = "";

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) {
      ctx.skip(skipReason || "Integration preflight did not complete.");
    }
  }

  beforeAll(async () => {
    if (!gate.shouldRun) {
      logIntegrationSkip(skipReason);
      return;
    }

    const preflight = await runPhase1IntegrationPreflight(gate.url, gate.serviceRoleKey);
    if (!preflight.shouldRun) {
      skipReason = preflight.skipReason;
      logIntegrationSkip(skipReason);
      return;
    }

    client = preflight.client;
    backend = new SupabaseBookingCommandBackend(client);

    const usingSeededCustomer = Boolean(getSeededIntegrationCustomerId());
    if (!usingSeededCustomer) {
      await cleanupStalePhase1TestData(client);
    }

    runId = createPhase1RunId();
    const provisioned = await provisionPhase1IntegrationCustomer(client, runId);
    if ("error" in provisioned) {
      skipReason = provisioned.error;
      logIntegrationSkip(skipReason);
      return;
    }

    customerId = provisioned.customerId;
    ready = true;
    if (usingSeededCustomer) {
      console.warn(
        `[booking integration] using seeded customer ${customerId} (no auth user creation).`,
      );
    }
  });

  afterAll(async () => {
    if (!ready || !client || !runId) return;
    await cleanupPhase1TestRunBookings(client, customerId, runId);
  });

  const systemActor = { actorType: "system" as const, profileId: null };

  async function createTaggedDraft(priceCents: number): Promise<string> {
    const draft = await executeBookingCommand(
      backend!,
      {
        type: "CREATE_BOOKING_DRAFT",
        actor: systemActor,
        customerId,
        scheduledStart: new Date().toISOString(),
        scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
        priceCents,
        metadata: phase1BookingMetadata(runId),
      },
      {},
    );
    expect(draft.ok).toBe(true);
    if (!draft.ok) throw new Error("draft failed");
    return draft.bookingId;
  }

  it("persists a successful booking status transition with audit row", async (ctx) => {
    skipUnlessReady(ctx);

    const bookingId = await createTaggedDraft(12_000);

    const pending = await executeBookingCommand(
      backend!,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: systemActor,
        bookingId,
        paymentIdempotencyKey: phase1PaymentKey(crypto.randomUUID()),
      },
      {},
    );
    expect(pending.ok, pending.ok ? undefined : `${pending.code}: ${pending.message}`).toBe(
      true,
    );

    const payments = await backend!.listPaymentsForBooking(bookingId);
    expect(payments.length).toBeGreaterThan(0);

    const idempotencyKey = phase1EventKey(crypto.randomUUID());
    const fin = await executeBookingCommand(
      backend!,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId: payments[0]!.id,
        idempotencyKey,
      },
      {},
    );
    expect(fin.ok).toBe(true);
    if (!fin.ok) return;
    expect(fin.status).toBe("confirmed");

    const { data: booking } = await client!
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();
    expect(booking?.status).toBe("confirmed");

    const { data: audits } = await client!
      .from("booking_state_audit")
      .select("*")
      .eq("booking_id", bookingId)
      .eq("to_status", "confirmed");
    expect(audits?.length).toBeGreaterThan(0);
    expect(audits?.some((a) => a.command === "FINALIZE_PAYMENT_SUCCESS")).toBe(true);
  });

  it("rejects invalid transitions without mutating booking status", async (ctx) => {
    skipUnlessReady(ctx);

    const bookingId = await createTaggedDraft(5000);

    const invalid = await executeBookingCommand(
      backend!,
      {
        type: "MARK_IN_PROGRESS",
        actor: systemActor,
        bookingId,
      },
      {},
    );
    expect(invalid.ok).toBe(false);
    if (invalid.ok) throw new Error("expected failure");
    expect(invalid.code).toBe("INVALID_TRANSITION");

    const { data: booking } = await client!
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();
    expect(booking?.status).toBe("draft");
  });

  it("respects finalize idempotency keys", async (ctx) => {
    skipUnlessReady(ctx);

    const bookingId = await createTaggedDraft(8000);

    const pending = await executeBookingCommand(
      backend!,
      {
        type: "MARK_PAYMENT_PENDING",
        actor: systemActor,
        bookingId,
        paymentIdempotencyKey: phase1PaymentKey(crypto.randomUUID()),
      },
      {},
    );
    expect(pending.ok, pending.ok ? undefined : `${pending.code}: ${pending.message}`).toBe(
      true,
    );
    const payments = await backend!.listPaymentsForBooking(bookingId);
    const idempotencyKey = phase1EventKey(crypto.randomUUID());

    const first = await executeBookingCommand(
      backend!,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId: payments[0]!.id,
        idempotencyKey,
      },
      {},
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.idempotent).toBe(false);

    const second = await executeBookingCommand(
      backend!,
      {
        type: "FINALIZE_PAYMENT_SUCCESS",
        actor: systemActor,
        bookingId,
        paymentId: payments[0]!.id,
        idempotencyKey,
      },
      {},
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.idempotent).toBe(true);

    const { count } = await client!
      .from("booking_state_audit")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", bookingId)
      .eq("idempotency_key", idempotencyKey);
    expect(count).toBe(1);
  });
  },
  30_000,
);
