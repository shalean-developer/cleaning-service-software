import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  CLEANER_LIFECYCLE_PHASE_B_SKIP,
  cleanupPhase2Run,
  clearPhase2SignedInClients,
  createUserScopedClient,
  isCleanerLifecycleSchemaPhaseBApplied,
  phase2RunId,
  provisionPhase2AuthUser,
  resolveRlsIntegrationGate,
  runRlsPreflight,
  signInAs,
} from "./rlsTestSupport";

const gate = resolveRlsIntegrationGate();

function logSkip(reason: string): void {
  console.warn(`[cleaner operational audit integration] skipped: ${reason}`);
}

describe("cleaner_operational_audit RLS (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let supabaseUrl = "";
  let supabaseAnonKey = "";
  let runId = "";
  let cleanerId = "";
  let adminProfileId = "";
  let adminEmail = "";
  let customerEmail = "";
  let cleanerEmail = "";
  let auditId = "";
  let phaseBApplied = false;

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "RLS preflight did not complete.");
  }

  function skipUnlessPhaseB(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!phaseBApplied) ctx.skip(CLEANER_LIFECYCLE_PHASE_B_SKIP);
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

    phaseBApplied = await isCleanerLifecycleSchemaPhaseBApplied(serviceClient);
    if (!phaseBApplied) {
      ready = true;
      return;
    }

    const admin = await provisionPhase2AuthUser(
      serviceClient,
      `admin_cln_audit_${runId}`,
      "admin",
    );
    const customer = await provisionPhase2AuthUser(
      serviceClient,
      `cust_cln_audit_${runId}`,
      "customer",
    );
    const cleaner = await provisionPhase2AuthUser(
      serviceClient,
      `cln_cln_audit_${runId}`,
      "cleaner",
    );

    adminEmail = admin.email;
    customerEmail = customer.email;
    cleanerEmail = cleaner.email;
    adminProfileId = admin.profileId;

    const { data: cleanerRow, error: cleanerErr } = await serviceClient
      .from("cleaners")
      .insert({
        profile_id: cleaner.profileId,
        phone: `${runId}_cleaner_audit`,
      })
      .select("id")
      .single();
    if (cleanerErr) throw new Error(cleanerErr.message);
    cleanerId = cleanerRow.id;

    const { data: audit, error: insertErr } = await serviceClient
      .from("cleaner_operational_audit")
      .insert({
        cleaner_id: cleanerId,
        admin_profile_id: adminProfileId,
        action: "schema_probe",
        outcome: "success",
        reason: "Integration test audit row",
        metadata: { test_run_id: runId },
      })
      .select("id")
      .single();

    if (insertErr) throw new Error(insertErr.message);
    auditId = audit!.id;
    ready = true;
  });

  afterAll(async () => {
    clearPhase2SignedInClients();
    if (serviceClient && runId) {
      await cleanupPhase2Run(serviceClient, runId);
    }
  });

  it("admin can read cleaner operational audit rows", async (ctx) => {
    skipUnlessPhaseB(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, adminEmail);

    const { data, error } = await client
      .from("cleaner_operational_audit")
      .select("id, action")
      .eq("cleaner_id", cleanerId);

    expect(error).toBeNull();
    expect((data ?? []).some((r) => r.id === auditId)).toBe(true);
  });

  it("customer cannot read cleaner operational audit rows", async (ctx) => {
    skipUnlessPhaseB(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, customerEmail);

    const { data, error } = await client
      .from("cleaner_operational_audit")
      .select("id")
      .eq("cleaner_id", cleanerId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("cleaner cannot read cleaner operational audit rows", async (ctx) => {
    skipUnlessPhaseB(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, cleanerEmail);

    const { data, error } = await client
      .from("cleaner_operational_audit")
      .select("id")
      .eq("cleaner_id", cleanerId);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("authenticated customer cannot insert cleaner operational audit", async (ctx) => {
    skipUnlessPhaseB(ctx);
    const client = createUserScopedClient(supabaseUrl, supabaseAnonKey);
    await signInAs(client, customerEmail);

    const { error } = await client.from("cleaner_operational_audit").insert({
      cleaner_id: cleanerId,
      admin_profile_id: adminProfileId,
      action: "forged",
      outcome: "failed",
      reason: "Should not insert",
    });

    expect(error).not.toBeNull();
  });

  it("service role can insert cleaner operational audit rows", async (ctx) => {
    skipUnlessPhaseB(ctx);

    const { data, error } = await serviceClient!
      .from("cleaner_operational_audit")
      .insert({
        cleaner_id: cleanerId,
        admin_profile_id: adminProfileId,
        action: "service_role_probe",
        outcome: "success",
        metadata: { test_run_id: runId },
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
  });

  it("blocks update and delete on cleaner operational audit", async (ctx) => {
    skipUnlessPhaseB(ctx);

    const { error: updateError } = await serviceClient!
      .from("cleaner_operational_audit")
      .update({ reason: "tampered" })
      .eq("id", auditId);

    expect(updateError).not.toBeNull();
    expect(updateError?.message ?? "").toMatch(/append-only/i);

    const { error: deleteError } = await serviceClient!
      .from("cleaner_operational_audit")
      .delete()
      .eq("id", auditId);

    expect(deleteError).not.toBeNull();
    expect(deleteError?.message ?? "").toMatch(/append-only/i);
  });
});
