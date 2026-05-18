import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  CLEANER_LIFECYCLE_COLUMN_GUARD_PHASE_C_SKIP,
  cleanupPhase2Run,
  clearPhase2SignedInClients,
  getSignedInPhase2Client,
  isCleanerLifecycleColumnGuardPhaseCApplied,
  isCleanerLifecycleSchemaPhaseBApplied,
  phase2RunId,
  provisionPhase2AuthUser,
  resolveRlsIntegrationGate,
  runRlsPreflight,
} from "./rlsTestSupport";

const gate = resolveRlsIntegrationGate();

const PHASE_B_SKIP =
  "Cleaner lifecycle Phase B not applied (lifecycle columns missing). Apply supabase/migrations/20260530120000_cleaner_lifecycle_schema_phase_b.sql (e.g. supabase db reset).";

function logSkip(reason: string): void {
  console.warn(`[cleaner lifecycle column guard Phase C] skipped: ${reason}`);
}

describe("Cleaner lifecycle column guard Phase C (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let supabaseUrl = "";
  let supabaseAnonKey = "";
  let runId = "";
  let cleanerId = "";
  let adminEmail = "";
  let cleanerEmail = "";
  let phaseBApplied = false;
  let phaseCApplied = false;

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "RLS preflight did not complete.");
  }

  function skipUnlessPhaseB(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!phaseBApplied) ctx.skip(PHASE_B_SKIP);
  }

  function skipUnlessPhaseC(ctx: TestContext): void {
    skipUnlessPhaseB(ctx);
    if (!phaseCApplied) ctx.skip(CLEANER_LIFECYCLE_COLUMN_GUARD_PHASE_C_SKIP);
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

    const admin = await provisionPhase2AuthUser(
      serviceClient,
      `admin_cln_guard_${runId}`,
      "admin",
    );
    const cleaner = await provisionPhase2AuthUser(
      serviceClient,
      `cln_guard_${runId}`,
      "cleaner",
    );

    adminEmail = admin.email;
    cleanerEmail = cleaner.email;

    const { data: cleanerRow, error: cleanerErr } = await serviceClient
      .from("cleaners")
      .insert({
        profile_id: cleaner.profileId,
        phone: `${runId}_cleaner_guard`,
      })
      .select("id")
      .single();
    if (cleanerErr) throw new Error(cleanerErr.message);
    cleanerId = cleanerRow.id;

    if (phaseBApplied) {
      const adminClient = await getSignedInPhase2Client(supabaseUrl, supabaseAnonKey, adminEmail);
      phaseCApplied = await isCleanerLifecycleColumnGuardPhaseCApplied(
        serviceClient,
        adminClient,
        cleanerId,
      );
    }

    ready = true;
  });

  afterAll(async () => {
    clearPhase2SignedInClients();
    if (serviceClient && runId) {
      await cleanupPhase2Run(serviceClient, runId);
    }
  });

  it("admin authenticated client cannot UPDATE lifecycle columns on cleaners", async (ctx) => {
    skipUnlessPhaseC(ctx);
    const client = await getSignedInPhase2Client(supabaseUrl, supabaseAnonKey, adminEmail);

    const before = await serviceClient!
      .from("cleaners")
      .select("active, lifecycle_reason")
      .eq("id", cleanerId)
      .single();
    expect(before.error).toBeNull();

    const { data, error } = await client
      .from("cleaners")
      .update({ active: !before.data!.active, lifecycle_reason: "admin_bypass_attempt" })
      .eq("id", cleanerId)
      .select("id");

    const after = await serviceClient!
      .from("cleaners")
      .select("active, lifecycle_reason")
      .eq("id", cleanerId)
      .single();
    expect(after.error).toBeNull();
    expect(after.data?.active).toBe(before.data?.active);
    expect(after.data?.lifecycle_reason).toBe(before.data?.lifecycle_reason);

    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/CLEANER_LIFECYCLE_COLUMN_MUTATION_FORBIDDEN/i);
    expect(data ?? []).toHaveLength(0);
  });

  it("cleaner cannot UPDATE own lifecycle columns", async (ctx) => {
    skipUnlessPhaseC(ctx);
    const client = await getSignedInPhase2Client(supabaseUrl, supabaseAnonKey, cleanerEmail);

    const before = await serviceClient!
      .from("cleaners")
      .select("active, suspended_at")
      .eq("id", cleanerId)
      .single();
    expect(before.error).toBeNull();

    const { data, error } = await client
      .from("cleaners")
      .update({ active: !before.data!.active })
      .eq("id", cleanerId)
      .select("id");

    const after = await serviceClient!
      .from("cleaners")
      .select("active")
      .eq("id", cleanerId)
      .single();
    expect(after.error).toBeNull();
    expect(after.data?.active).toBe(before.data?.active);

    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/CLEANER_LIFECYCLE_COLUMN_MUTATION_FORBIDDEN/i);
    expect(data ?? []).toHaveLength(0);
  });

  it("admin can still UPDATE non-lifecycle columns (e.g. phone)", async (ctx) => {
    skipUnlessPhaseC(ctx);
    const client = await getSignedInPhase2Client(supabaseUrl, supabaseAnonKey, adminEmail);
    const phone = `${runId}_admin_phone_ok`;

    const { data, error } = await client
      .from("cleaners")
      .update({ phone })
      .eq("id", cleanerId)
      .select("phone");

    expect(error).toBeNull();
    expect(data?.[0]?.phone).toBe(phone);
  });

  it("service role can UPDATE lifecycle columns for controlled operations", async (ctx) => {
    skipUnlessPhaseC(ctx);

    const before = await serviceClient!
      .from("cleaners")
      .select("active, lifecycle_reason")
      .eq("id", cleanerId)
      .single();
    expect(before.error).toBeNull();

    const targetActive = !before.data!.active;
    const targetReason = `${runId}_service_role_probe`;

    const { data, error } = await serviceClient!
      .from("cleaners")
      .update({ active: targetActive, lifecycle_reason: targetReason })
      .eq("id", cleanerId)
      .select("active, lifecycle_reason");

    expect(error).toBeNull();
    expect(data?.[0]?.active).toBe(targetActive);
    expect(data?.[0]?.lifecycle_reason).toBe(targetReason);

    await serviceClient!
      .from("cleaners")
      .update({
        active: before.data!.active,
        lifecycle_reason: before.data!.lifecycle_reason,
      })
      .eq("id", cleanerId);
  });
});
