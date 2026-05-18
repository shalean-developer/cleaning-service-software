import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  assertServiceRoleKey,
  assertSupabaseReachable,
  isLocalSupabaseUrl,
  postgrestErrorText,
} from "@/features/bookings/server/commands/phase1IntegrationTestSupport";
import { purgeCleanerOperationalRows } from "./rlsTestSupport";

export const STAGE1C_TEST_PREFIX = "test_stage1c_";
export const STAGE1C_TEST_EMAIL_DOMAIN = "shalean.co.za";
export const STAGE1C_TEST_PASSWORD = "integration-test-password";

export type HandleNewUserIntegrationGate =
  | {
      shouldRun: true;
      url: string;
      serviceRoleKey: string;
      isRemote: boolean;
    }
  | { shouldRun: false; skipReason: string };

export function resolveHandleNewUserIntegrationGate(): HandleNewUserIntegrationGate {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

  if (!url?.trim() || !serviceRoleKey?.trim()) {
    return {
      shouldRun: false,
      skipReason:
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run handle_new_user integration tests.",
    };
  }

  const isRemote = !isLocalSupabaseUrl(url.trim());
  if (isRemote && process.env.BOOKING_COMMAND_RUN_REMOTE_INTEGRATION !== "true") {
    return {
      shouldRun: false,
      skipReason:
        "Remote Supabase detected. Set BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true to run handle_new_user tests.",
    };
  }

  return {
    shouldRun: true,
    url: url.trim(),
    serviceRoleKey: serviceRoleKey.trim(),
    isRemote,
  };
}

export function stage1cRunId(): string {
  return `${STAGE1C_TEST_PREFIX}${crypto.randomUUID()}`;
}

export function stage1cEmail(slug: string): string {
  return `${STAGE1C_TEST_PREFIX}${slug}@${STAGE1C_TEST_EMAIL_DOMAIN}`;
}

export async function runHandleNewUserPreflight(
  url: string,
  serviceRoleKey: string,
): Promise<
  | { shouldRun: true; serviceClient: SupabaseClient<Database> }
  | { shouldRun: false; skipReason: string }
> {
  try {
    const serviceClient = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await assertSupabaseReachable(serviceClient, serviceRoleKey);
    assertServiceRoleKey(serviceRoleKey);
    return { shouldRun: true, serviceClient };
  } catch (e) {
    return {
      shouldRun: false,
      skipReason: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function createAuthUserWithMetadata(
  serviceClient: SupabaseClient<Database>,
  email: string,
  userMetadata: Record<string, unknown>,
): Promise<string> {
  const created = await serviceClient.auth.admin.createUser({
    email,
    password: STAGE1C_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: userMetadata,
  });
  if (created.error || !created.data.user) {
    throw new Error(
      created.error
        ? postgrestErrorText(created.error)
        : `Failed to create auth user ${email}`,
    );
  }
  return created.data.user.id;
}

export async function fetchProfileRole(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
): Promise<string | null> {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.role ?? null;
}

export async function cleanupStage1cAuthUser(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
): Promise<void> {
  await serviceClient.from("customers").delete().eq("profile_id", profileId);

  const { data: cleanerRow } = await serviceClient
    .from("cleaners")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (cleanerRow?.id) {
    await purgeCleanerOperationalRows(serviceClient, cleanerRow.id);
  }

  await serviceClient.from("cleaners").delete().eq("profile_id", profileId);
  await serviceClient.from("profiles").delete().eq("id", profileId);
  await serviceClient.auth.admin.deleteUser(profileId);
}
