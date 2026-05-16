import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  cleanupStage1cAuthUser,
  createAuthUserWithMetadata,
  resolveHandleNewUserIntegrationGate,
  runHandleNewUserPreflight,
  stage1cEmail,
  stage1cRunId,
} from "./handleNewUserTestSupport";

const gate = resolveHandleNewUserIntegrationGate();

function logSkip(reason: string): void {
  console.warn(`[customer provisioning integration] skipped: ${reason}`);
}

async function fetchCustomerByProfileId(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
) {
  const { data, error } = await serviceClient
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function replaceProfile(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
  role: "customer" | "admin" | "cleaner",
  fullName: string,
): Promise<void> {
  await serviceClient.from("customers").delete().eq("profile_id", profileId);
  const { error: deleteProfileError } = await serviceClient
    .from("profiles")
    .delete()
    .eq("id", profileId);
  if (deleteProfileError) throw new Error(deleteProfileError.message);

  const { error: insertError } = await serviceClient.from("profiles").insert({
    id: profileId,
    role,
    full_name: fullName,
  });
  if (insertError) throw new Error(insertError.message);
}

async function ensureCustomerProvisioned(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
): Promise<string | null> {
  const { data, error } = await serviceClient.rpc("ensure_customer_provisioned", {
    profile_id: profileId,
  });
  if (error) throw new Error(error.message);
  return data;
}

describe("customer auto-provisioning (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let runId = "";
  const createdProfileIds: string[] = [];

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "customer provisioning preflight did not complete.");
  }

  beforeAll(async () => {
    if (!gate.shouldRun) {
      logSkip(skipReason);
      return;
    }

    const preflight = await runHandleNewUserPreflight(gate.url, gate.serviceRoleKey);
    if (!preflight.shouldRun) {
      skipReason = preflight.skipReason;
      logSkip(skipReason);
      return;
    }

    serviceClient = preflight.serviceClient;
    runId = stage1cRunId();
    ready = true;
  });

  afterAll(async () => {
    if (!serviceClient) return;
    for (const profileId of createdProfileIds) {
      try {
        await cleanupStage1cAuthUser(serviceClient, profileId);
      } catch {
        // best-effort cleanup
      }
    }
  });

  it("creates a customers row when a customer profile is inserted via auth signup", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`cust_provision_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Provisioned Customer",
    });
    createdProfileIds.push(profileId);

    const customer = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customer).not.toBeNull();
    expect(customer?.profile_id).toBe(profileId);
    expect(customer?.company_name).toBe("Provisioned Customer");
  });

  it("does not create a customers row when an admin profile is inserted", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`admin_no_cust_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Admin No Customer",
    });
    createdProfileIds.push(profileId);

    await replaceProfile(serviceClient!, profileId, "admin", "Admin No Customer");

    const customer = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customer).toBeNull();
  });

  it("does not create a customers row when a cleaner profile is inserted", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`cleaner_no_cust_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Cleaner No Customer",
    });
    createdProfileIds.push(profileId);

    await replaceProfile(serviceClient!, profileId, "cleaner", "Cleaner No Customer");

    const customer = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customer).toBeNull();
  });

  it("ensure_customer_provisioned is idempotent and returns the same customers.id", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`rpc_idempotent_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "RPC Idempotent",
    });
    createdProfileIds.push(profileId);

    const firstId = await ensureCustomerProvisioned(serviceClient!, profileId);
    const secondId = await ensureCustomerProvisioned(serviceClient!, profileId);

    expect(firstId).toBeTruthy();
    expect(secondId).toBe(firstId);

    const { count, error } = await serviceClient!
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    expect(count).toBe(1);
  });

  it("ensure_customer_provisioned repairs an orphan customer profile", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`orphan_repair_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Orphan Repair",
    });
    createdProfileIds.push(profileId);

    const { error: deleteError } = await serviceClient!
      .from("customers")
      .delete()
      .eq("profile_id", profileId);
    expect(deleteError).toBeNull();

    const before = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(before).toBeNull();

    const repairedId = await ensureCustomerProvisioned(serviceClient!, profileId);
    expect(repairedId).toBeTruthy();

    const after = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(after?.id).toBe(repairedId);
    expect(after?.company_name).toBe("Orphan Repair");
  });

  it("ensure_customer_provisioned does not provision admin or cleaner profiles", async (ctx) => {
    skipUnlessReady(ctx);
    const adminEmail = stage1cEmail(`rpc_admin_${runId}`);
    const adminProfileId = await createAuthUserWithMetadata(serviceClient!, adminEmail, {
      full_name: "RPC Admin",
    });
    createdProfileIds.push(adminProfileId);
    await replaceProfile(serviceClient!, adminProfileId, "admin", "RPC Admin");

    const cleanerEmail = stage1cEmail(`rpc_cleaner_${runId}`);
    const cleanerProfileId = await createAuthUserWithMetadata(
      serviceClient!,
      cleanerEmail,
      { full_name: "RPC Cleaner" },
    );
    createdProfileIds.push(cleanerProfileId);
    await replaceProfile(serviceClient!, cleanerProfileId, "cleaner", "RPC Cleaner");

    expect(await ensureCustomerProvisioned(serviceClient!, adminProfileId)).toBeNull();
    expect(await ensureCustomerProvisioned(serviceClient!, cleanerProfileId)).toBeNull();
    expect(await fetchCustomerByProfileId(serviceClient!, adminProfileId)).toBeNull();
    expect(await fetchCustomerByProfileId(serviceClient!, cleanerProfileId)).toBeNull();
  });

  it("matches E2E seed: auto-provisioned row plus service-role upsert still works", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`e2e_customer_seed_${runId}`);
    const companyName = `test_e2e_customer_${runId}`;
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      role: "customer",
      full_name: "E2E Customer Seed",
      e2e_seed: true,
    });
    createdProfileIds.push(profileId);

    const autoProvisioned = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(autoProvisioned).not.toBeNull();

    const { error: profileError } = await serviceClient!.from("profiles").upsert(
      { id: profileId, role: "customer", full_name: "E2E Customer Seed" },
      { onConflict: "id" },
    );
    expect(profileError).toBeNull();

    const { data: byProfile } = await serviceClient!
      .from("customers")
      .select("id, profile_id, company_name")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (byProfile && byProfile.company_name !== companyName) {
      const { error: updateError } = await serviceClient!
        .from("customers")
        .update({ company_name: companyName })
        .eq("id", byProfile.id);
      expect(updateError).toBeNull();
    } else if (!byProfile) {
      const { error: insertError } = await serviceClient!.from("customers").insert({
        profile_id: profileId,
        company_name: companyName,
      });
      expect(insertError).toBeNull();
    }

    const customer = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customer).not.toBeNull();
    expect(customer?.company_name).toBe(companyName);
  });
});
