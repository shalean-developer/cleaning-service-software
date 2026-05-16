import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  assertServiceRoleKey,
  assertSupabaseReachable,
  isLocalSupabaseUrl,
  postgrestErrorText,
} from "@/features/bookings/server/commands/phase1IntegrationTestSupport";

export const PHASE2_TEST_PREFIX = "test_phase2_";
export const PHASE2_TEST_EMAIL_DOMAIN = "shalean.co.za";
export const PHASE2_TEST_PASSWORD = "integration-test-password";

export type RlsIntegrationGate =
  | {
      shouldRun: true;
      url: string;
      serviceRoleKey: string;
      anonKey: string;
      isRemote: boolean;
    }
  | { shouldRun: false; skipReason: string };

export function resolveRlsIntegrationGate(): RlsIntegrationGate {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    null;

  if (!url?.trim() || !serviceRoleKey?.trim()) {
    return {
      shouldRun: false,
      skipReason:
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run RLS integration tests.",
    };
  }

  if (!anonKey?.trim()) {
    return {
      shouldRun: false,
      skipReason:
        "Set NEXT_PUBLIC_SUPABASE_ANON_KEY to run RLS integration tests with user-scoped clients.",
    };
  }

  const isRemote = !isLocalSupabaseUrl(url.trim());
  if (isRemote && process.env.BOOKING_COMMAND_RUN_REMOTE_INTEGRATION !== "true") {
    return {
      shouldRun: false,
      skipReason:
        "Remote Supabase detected. Set BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true to run RLS tests.",
    };
  }

  return {
    shouldRun: true,
    url: url.trim(),
    serviceRoleKey: serviceRoleKey.trim(),
    anonKey: anonKey.trim(),
    isRemote,
  };
}

export function phase2RunId(): string {
  return `${PHASE2_TEST_PREFIX}${crypto.randomUUID()}`;
}

export function phase2Email(slug: string): string {
  return `${PHASE2_TEST_PREFIX}${slug}@${PHASE2_TEST_EMAIL_DOMAIN}`;
}

export async function runRlsPreflight(
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

    const { error } = await serviceClient.rpc("auth_is_admin" as never);
    if (error?.code === "PGRST202" || error?.message?.includes("auth_is_admin")) {
      return {
        shouldRun: false,
        skipReason:
          "RLS migration not applied (auth_is_admin missing). Run supabase db push.",
      };
    }

    return { shouldRun: true, serviceClient };
  } catch (e) {
    return {
      shouldRun: false,
      skipReason: e instanceof Error ? e.message : String(e),
    };
  }
}

export function createUserScopedClient(
  url: string,
  anonKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function provisionPhase2AuthUser(
  serviceClient: SupabaseClient<Database>,
  slug: string,
  role: "customer" | "cleaner" | "admin",
): Promise<{ profileId: string; email: string }> {
  const email = phase2Email(slug);

  const existing = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (existing.error) throw new Error(existing.error.message);
  const found = (existing.data.users ?? []).find((u) => u.email === email);
  if (found) {
    await serviceClient.from("profiles").upsert(
      { id: found.id, role, full_name: `Phase 2 ${slug}` },
      { onConflict: "id" },
    );
    return { profileId: found.id, email };
  }

  const created = await serviceClient.auth.admin.createUser({
    email,
    password: PHASE2_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { phase2_rls: true, role },
  });
  if (created.error || !created.data.user) {
    throw new Error(
      created.error
        ? postgrestErrorText(created.error)
        : `Failed to create auth user ${email}`,
    );
  }

  const profileId = created.data.user.id;
  await serviceClient.from("profiles").upsert(
    { id: profileId, role, full_name: `Phase 2 ${slug}` },
    { onConflict: "id" },
  );

  return { profileId, email };
}

/** Uses auto-provisioned customers row when present (Stage 1C-2), else inserts. */
export async function ensurePhase2CustomerRow(
  serviceClient: SupabaseClient<Database>,
  profileId: string,
  companyName: string,
): Promise<string> {
  const { data: existing, error: fetchError } = await serviceClient
    .from("customers")
    .select("id, company_name")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  if (existing) {
    if (existing.company_name !== companyName) {
      const { error: updateError } = await serviceClient
        .from("customers")
        .update({ company_name: companyName })
        .eq("id", existing.id);
      if (updateError) throw new Error(updateError.message);
    }
    return existing.id;
  }

  const { data: created, error: insertError } = await serviceClient
    .from("customers")
    .insert({ profile_id: profileId, company_name: companyName })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return created.id;
}

export async function signInAs(
  client: SupabaseClient<Database>,
  email: string,
): Promise<void> {
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PHASE2_TEST_PASSWORD,
  });
  if (error) throw new Error(error.message);
}

export async function cleanupPhase2Run(
  serviceClient: SupabaseClient<Database>,
  runId: string,
): Promise<void> {
  const marker = runId;

  const { data: bookings } = await serviceClient
    .from("bookings")
    .select("id, metadata")
    .contains("metadata", { test_phase2_run_id: marker });

  const bookingIds = (bookings ?? []).map((b) => b.id);
  if (bookingIds.length > 0) {
    await serviceClient.from("earning_lines").delete().in("booking_id", bookingIds);
    await serviceClient.from("assignment_offers").delete().in("booking_id", bookingIds);
    await serviceClient.from("payments").delete().in("booking_id", bookingIds);
    await serviceClient.from("bookings").delete().in("id", bookingIds);
  }

  const { data: customers } = await serviceClient
    .from("customers")
    .select("id, profile_id, company_name")
    .like("company_name", `${PHASE2_TEST_PREFIX}%`);

  for (const customer of customers ?? []) {
    if (!customer.company_name?.includes(marker)) continue;
    await serviceClient.from("customers").delete().eq("id", customer.id);
    await serviceClient.from("profiles").delete().eq("id", customer.profile_id);
    await serviceClient.auth.admin.deleteUser(customer.profile_id);
  }

  const { data: cleaners } = await serviceClient
    .from("cleaners")
    .select("id, profile_id")
    .like("phone", `${PHASE2_TEST_PREFIX}%`);

  for (const cleaner of cleaners ?? []) {
    await serviceClient.from("cleaners").delete().eq("id", cleaner.id);
    await serviceClient.from("profiles").delete().eq("id", cleaner.profile_id);
    await serviceClient.auth.admin.deleteUser(cleaner.profile_id);
  }

  const adminEmail = phase2Email(`admin_${marker}`);
  const { data: users } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 200 });
  const adminUser = (users?.users ?? []).find((u) => u.email === adminEmail);
  if (adminUser) {
    await serviceClient.from("profiles").delete().eq("id", adminUser.id);
    await serviceClient.auth.admin.deleteUser(adminUser.id);
  }
}
