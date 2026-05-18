import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  CLEANER_LIFECYCLE_PHASE_A_SKIP,
  cleanupPhase2Run,
  clearPhase2SignedInClients,
  getSignedInPhase2Client,
  isCleanerLifecycleSafetyPhaseAApplied,
  phase2RunId,
  provisionPhase2AuthUser,
  purgeCleanerOperationalRows,
  resolveRlsIntegrationGate,
  runRlsPreflight,
} from "./rlsTestSupport";

const gate = resolveRlsIntegrationGate();

function logSkip(reason: string): void {
  console.warn(`[cleaner lifecycle Phase A] skipped: ${reason}`);
}

describe("Cleaner lifecycle safety Phase A (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let supabaseUrl = "";
  let supabaseAnonKey = "";
  let runId = "";
  let adminEmail = "";
  let cleanerDeleteProbeId = "";
  let phaseAApplied = false;

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "RLS preflight did not complete.");
  }

  function skipUnlessPhaseA(ctx: TestContext): void {
    skipUnlessReady(ctx);
    if (!phaseAApplied) ctx.skip(CLEANER_LIFECYCLE_PHASE_A_SKIP);
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

    const admin = await provisionPhase2AuthUser(serviceClient, `admin_${runId}`, "admin");
    adminEmail = admin.email;

    const deleteProbeUser = await provisionPhase2AuthUser(
      serviceClient,
      `cleaner_del_probe_${runId}`,
      "cleaner",
    );
    const { data: probeRow, error: probeErr } = await serviceClient
      .from("cleaners")
      .insert({
        profile_id: deleteProbeUser.profileId,
        phone: `${runId}_cleaner_del_probe`,
      })
      .select("id")
      .single();
    if (probeErr) throw new Error(probeErr.message);
    cleanerDeleteProbeId = probeRow.id;

    const adminClient = await getSignedInPhase2Client(supabaseUrl, supabaseAnonKey, adminEmail);
    phaseAApplied = await isCleanerLifecycleSafetyPhaseAApplied(
      serviceClient,
      adminClient,
      cleanerDeleteProbeId,
    );

    ready = true;
  });

  afterAll(async () => {
    clearPhase2SignedInClients();
    if (serviceClient && runId) {
      await cleanupPhase2Run(serviceClient, runId);
    }
  });

  it("admin authenticated client cannot DELETE from public.cleaners", async (ctx) => {
    skipUnlessPhaseA(ctx);
    const client = await getSignedInPhase2Client(supabaseUrl, supabaseAnonKey, adminEmail);

    const { data, error } = await client
      .from("cleaners")
      .delete()
      .eq("id", cleanerDeleteProbeId)
      .select("id");

    const stillThere = await serviceClient!
      .from("cleaners")
      .select("id")
      .eq("id", cleanerDeleteProbeId)
      .single();
    expect(stillThere.error).toBeNull();
    expect(stillThere.data?.id).toBe(cleanerDeleteProbeId);

    if (error) {
      expect(error.message ?? "").toMatch(
        /row-level security|permission denied|42501|insufficient privilege/i,
      );
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("service role can still purge test cleaner rows when children are removed first", async (ctx) => {
    skipUnlessReady(ctx);
    const probeUser = await provisionPhase2AuthUser(
      serviceClient!,
      `cleaner_purge_${runId}`,
      "cleaner",
    );
    const { data: row, error: insertErr } = await serviceClient!
      .from("cleaners")
      .insert({
        profile_id: probeUser.profileId,
        phone: `${runId}_cleaner_purge`,
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(insertErr.message);

    await purgeCleanerOperationalRows(serviceClient!, row.id);
    const { error: delErr } = await serviceClient!.from("cleaners").delete().eq("id", row.id);
    expect(delErr).toBeNull();

    await serviceClient!.from("profiles").delete().eq("id", probeUser.profileId);
    await serviceClient!.auth.admin.deleteUser(probeUser.profileId);
  });
});
