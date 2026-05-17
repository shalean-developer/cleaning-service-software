import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  cleanupPhase2Run,
  createUserScopedClient,
  phase2RunId,
  provisionPhase2AuthUser,
  resolveRlsIntegrationGate,
  runRlsPreflight,
  signInAs,
} from "./rlsTestSupport";

const gate = resolveRlsIntegrationGate();

function logSkip(reason: string): void {
  console.warn(`[admin operational audit integration] skipped: ${reason}`);
}

describe("admin_operational_audit RLS (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let supabaseUrl = "";
  let supabaseAnonKey = "";
  let runId = "";
  let bookingId = "";
  let adminEmail = "";
  let customerEmail = "";
  let cleanerEmail = "";
  let auditId = "";

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
    runId = phase2RunId();

    const admin = await provisionPhase2AuthUser(serviceClient, `admin_audit_${runId}`, "admin");
    const customer = await provisionPhase2AuthUser(serviceClient, `cust_audit_${runId}`, "customer");
    const cleaner = await provisionPhase2AuthUser(serviceClient, `cln_audit_${runId}`, "cleaner");

    adminEmail = admin.email;
    customerEmail = customer.email;
    cleanerEmail = cleaner.email;

    const { data: customerRow } = await serviceClient
      .from("customers")
      .select("id")
      .eq("profile_id", customer.profileId)
      .single();

    const scheduleStart = new Date().toISOString();
    const scheduleEnd = new Date(Date.now() + 3_600_000).toISOString();

    const { data: booking } = await serviceClient
      .from("bookings")
      .insert({
        customer_id: customerRow!.id,
        status: "pending_assignment",
        scheduled_start: scheduleStart,
        scheduled_end: scheduleEnd,
        price_cents: 10_000,
        metadata: { test_run_id: runId },
      })
      .select("id")
      .single();

    bookingId = booking!.id;

    const { data: audit } = await serviceClient
      .from("admin_operational_audit")
      .insert({
        booking_id: bookingId,
        admin_profile_id: admin.profileId,
        action: "assignment_recovery",
        outcome: "success",
        reason: "Integration test audit row",
        metadata: { engine_outcome: "offered" },
      })
      .select("id")
      .single();

    auditId = audit!.id;
    ready = true;
  });

  afterAll(async () => {
    if (!ready || !serviceClient) return;
    await cleanupPhase2Run(serviceClient, runId);
  });

  it("admin can read operational audit rows", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, adminEmail);

    const { data, error } = await client
      .from("admin_operational_audit")
      .select("id, action")
      .eq("booking_id", bookingId);

    expect(error).toBeNull();
    expect((data ?? []).some((r) => r.id === auditId)).toBe(true);
  });

  it("customer cannot read operational audit rows", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, customerEmail);

    const { data, error } = await client
      .from("admin_operational_audit")
      .select("id")
      .eq("booking_id", bookingId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cleaner cannot read operational audit rows", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, cleanerEmail);

    const { data, error } = await client
      .from("admin_operational_audit")
      .select("id")
      .eq("booking_id", bookingId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("authenticated customer cannot insert operational audit", async (ctx) => {
    skipUnlessReady(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, customerEmail);

    const { error } = await client.from("admin_operational_audit").insert({
      booking_id: bookingId,
      admin_profile_id: "00000000-0000-0000-0000-000000000000",
      action: "assignment_recovery",
      outcome: "failed",
      reason: "Should not insert",
    });

    expect(error).not.toBeNull();
  });

  it("blocks update and delete on operational audit", async (ctx) => {
    skipUnlessReady(ctx);

    const { error: updateError } = await serviceClient!
      .from("admin_operational_audit")
      .update({ reason: "tampered" })
      .eq("id", auditId);

    expect(updateError).not.toBeNull();
    expect(updateError?.message ?? "").toMatch(/append-only/i);

    const { error: deleteError } = await serviceClient!
      .from("admin_operational_audit")
      .delete()
      .eq("id", auditId);

    expect(deleteError).not.toBeNull();
    expect(deleteError?.message ?? "").toMatch(/append-only/i);
  });
});
