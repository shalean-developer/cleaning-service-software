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
  console.warn(`[customer domain hardening integration] skipped: ${reason}`);
}

async function fetchCustomerByProfileId(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
) {
  const { data, error } = await serviceClient
    .from("customers")
    .select("id, profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function updateProfileRole(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
  role: "customer" | "admin" | "cleaner",
) {
  const { error } = await serviceClient
    .from("profiles")
    .update({ role })
    .eq("id", profileId);
  if (error) throw new Error(error.message);
}

describe("customer domain hardening (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let runId = "";
  const createdProfileIds: string[] = [];

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "preflight did not complete.");
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
        // best-effort
      }
    }
  });

  it("provisions customers row when profile role updates to customer", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`harden_promote_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Harden Promote",
    });
    createdProfileIds.push(profileId);

    await updateProfileRole(serviceClient!, profileId, "admin");
    expect(await fetchCustomerByProfileId(serviceClient!, profileId)).toBeNull();

    await updateProfileRole(serviceClient!, profileId, "customer");
    const customer = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customer).not.toBeNull();
    expect(customer?.profile_id).toBe(profileId);
  });

  it("removes customers row when role leaves customer and bookings = 0", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`harden_demote_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Harden Demote",
    });
    createdProfileIds.push(profileId);

    const before = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(before).not.toBeNull();

    await updateProfileRole(serviceClient!, profileId, "cleaner");
    expect(await fetchCustomerByProfileId(serviceClient!, profileId)).toBeNull();
  });

  it("preserves customers row when role leaves customer but bookings exist", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`harden_booking_keep_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Harden Booking Keep",
    });
    createdProfileIds.push(profileId);

    const customer = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customer).not.toBeNull();

    const scheduledStart = new Date().toISOString();
    const scheduledEnd = new Date(Date.now() + 3_600_000).toISOString();
    const { data: booking, error: bookingErr } = await serviceClient!
      .from("bookings")
      .insert({
        customer_id: customer!.id,
        status: "draft",
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        price_cents: 100,
      })
      .select("id")
      .single();
    if (bookingErr) throw new Error(bookingErr.message);

    const { count: bookingCountBefore, error: countErr } = await serviceClient!
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer!.id);
    if (countErr) throw new Error(countErr.message);
    expect(bookingCountBefore).toBe(1);

    await updateProfileRole(serviceClient!, profileId, "admin");

    const customerAfter = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customerAfter?.id).toBe(customer!.id);

    const { data: bookingAfter, error: fetchBookingErr } = await serviceClient!
      .from("bookings")
      .select("id, customer_id, status, scheduled_start, scheduled_end, price_cents")
      .eq("id", booking!.id)
      .single();
    if (fetchBookingErr) throw new Error(fetchBookingErr.message);
    expect(bookingAfter?.customer_id).toBe(customer!.id);
    expect(bookingAfter?.status).toBe("draft");
    expect(bookingAfter?.price_cents).toBe(100);

    await serviceClient!.from("bookings").delete().eq("id", booking!.id);
  });

  it("rejects customers insert for admin profile", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`harden_no_cust_admin_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Harden Admin",
    });
    createdProfileIds.push(profileId);
    await updateProfileRole(serviceClient!, profileId, "admin");

    const { error } = await serviceClient!.from("customers").insert({
      profile_id: profileId,
      company_name: "Should Fail",
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/expected customer/i);
  });

  it("rejects cleaners insert for customer profile", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`harden_no_cln_cust_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Harden Customer",
    });
    createdProfileIds.push(profileId);

    const { error } = await serviceClient!.from("cleaners").insert({
      profile_id: profileId,
      phone: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/expected cleaner/i);
  });

  it("rejects cleaners insert when customers row already exists", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`harden_dual_block_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      full_name: "Harden Dual Block",
    });
    createdProfileIds.push(profileId);

    await updateProfileRole(serviceClient!, profileId, "cleaner");
    const customer = await fetchCustomerByProfileId(serviceClient!, profileId);
    expect(customer).toBeNull();

    await updateProfileRole(serviceClient!, profileId, "customer");
    expect(await fetchCustomerByProfileId(serviceClient!, profileId)).not.toBeNull();

    const { error } = await serviceClient!.from("cleaners").insert({
      profile_id: profileId,
      phone: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/expected cleaner|customers row/i);
  });
});
