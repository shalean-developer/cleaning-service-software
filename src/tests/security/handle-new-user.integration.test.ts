import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  cleanupStage1cAuthUser,
  createAuthUserWithMetadata,
  fetchProfileRole,
  resolveHandleNewUserIntegrationGate,
  runHandleNewUserPreflight,
  stage1cEmail,
  stage1cRunId,
} from "./handleNewUserTestSupport";

const gate = resolveHandleNewUserIntegrationGate();

function logSkip(reason: string): void {
  console.warn(`[handle_new_user integration] skipped: ${reason}`);
}

describe("handle_new_user (Supabase integration)", () => {
  let ready = false;
  let skipReason = gate.shouldRun ? "" : gate.skipReason;
  let serviceClient: SupabaseClient<Database> | null = null;
  let runId = "";
  const createdProfileIds: string[] = [];

  function skipUnlessReady(ctx: TestContext): void {
    if (!ready) ctx.skip(skipReason || "handle_new_user preflight did not complete.");
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

  it("creates customer profile when auth metadata role is admin", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`admin_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      role: "admin",
      full_name: "Stage 1C admin metadata",
    });
    createdProfileIds.push(profileId);

    const role = await fetchProfileRole(serviceClient!, profileId);
    expect(role).toBe("customer");
  });

  it("creates customer profile when auth metadata role is cleaner", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`cleaner_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      role: "cleaner",
      full_name: "Stage 1C cleaner metadata",
    });
    createdProfileIds.push(profileId);

    const role = await fetchProfileRole(serviceClient!, profileId);
    expect(role).toBe("customer");
  });

  it("matches E2E seed: trigger customer then service-role upsert sets admin", async (ctx) => {
    skipUnlessReady(ctx);
    const email = stage1cEmail(`e2e_seed_${runId}`);
    const profileId = await createAuthUserWithMetadata(serviceClient!, email, {
      role: "admin",
      full_name: "E2E seed user",
      e2e_seed: true,
    });
    createdProfileIds.push(profileId);

    const triggerRole = await fetchProfileRole(serviceClient!, profileId);
    expect(triggerRole).toBe("customer");

    const { error: upsertError } = await serviceClient!.from("profiles").upsert(
      { id: profileId, role: "admin", full_name: "E2E seed user" },
      { onConflict: "id" },
    );
    expect(upsertError).toBeNull();

    const finalRole = await fetchProfileRole(serviceClient!, profileId);
    expect(finalRole).toBe("admin");
  });
});
