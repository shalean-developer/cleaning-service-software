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

const PAYMENTS_PHASE1_SKIP =
  "5B-3a migration not applied (admin can still write payments). Apply supabase/migrations/20260518140000_rls_payments_admin_select_only.sql (e.g. supabase db reset).";

/**
 * Returns whether payments_admin_write was dropped (admin JWT cannot UPDATE payments).
 */
export async function isPaymentsRlsPhase1Applied(
  serviceClient: SupabaseClient<Database>,
  adminUserClient: SupabaseClient<Database>,
  paymentId: string,
): Promise<boolean> {
  await serviceClient
    .from("payments")
    .update({ status: "initialized" })
    .eq("id", paymentId);

  const { data: updated, error: updateError } = await adminUserClient
    .from("payments")
    .update({ status: "paid" })
    .eq("id", paymentId)
    .select("status");

  const { data: row } = await serviceClient
    .from("payments")
    .select("status")
    .eq("id", paymentId)
    .single();

  await serviceClient
    .from("payments")
    .update({ status: "initialized" })
    .eq("id", paymentId);

  if (updateError) return true;
  if ((updated ?? []).length === 0 && row?.status === "initialized") return true;
  return false;
}

export { PAYMENTS_PHASE1_SKIP };

const EARNING_LINES_PHASE3B_SKIP =
  "5B-3b-a migration not applied (admin can still write earning_lines). Apply supabase/migrations/20260518150000_rls_earning_lines_admin_select_only.sql (e.g. supabase db reset).";

/**
 * Returns whether earning_lines_admin_write was dropped (admin JWT cannot UPDATE payout_status).
 */
export async function isEarningLinesRlsPhase3bApplied(
  serviceClient: SupabaseClient<Database>,
  adminUserClient: SupabaseClient<Database>,
  earningLineId: string,
): Promise<boolean> {
  await serviceClient
    .from("earning_lines")
    .update({ payout_status: "pending" })
    .eq("id", earningLineId);

  const { data: updated, error: updateError } = await adminUserClient
    .from("earning_lines")
    .update({ payout_status: "paid" })
    .eq("id", earningLineId)
    .select("payout_status");

  const { data: row } = await serviceClient
    .from("earning_lines")
    .select("payout_status")
    .eq("id", earningLineId)
    .single();

  await serviceClient
    .from("earning_lines")
    .update({ payout_status: "pending" })
    .eq("id", earningLineId);

  if (updateError) return true;
  if ((updated ?? []).length === 0 && row?.payout_status === "pending") return true;
  return false;
}

export { EARNING_LINES_PHASE3B_SKIP };

const ASSIGNMENT_OFFERS_PHASE3C_SKIP =
  "5B-3c-a migration not applied (admin can still write assignment_offers). Apply supabase/migrations/20260518160000_rls_assignment_offers_admin_select_only.sql (e.g. supabase db reset).";

/**
 * Returns whether assignment_offers_admin_write was dropped (admin JWT cannot UPDATE offer status).
 */
export async function isAssignmentOffersRlsPhase3cApplied(
  serviceClient: SupabaseClient<Database>,
  adminUserClient: SupabaseClient<Database>,
  offerId: string,
): Promise<boolean> {
  await serviceClient
    .from("assignment_offers")
    .update({ status: "offered" })
    .eq("id", offerId);

  const { data: updated, error: updateError } = await adminUserClient
    .from("assignment_offers")
    .update({ status: "accepted" })
    .eq("id", offerId)
    .select("status");

  const { data: row } = await serviceClient
    .from("assignment_offers")
    .select("status")
    .eq("id", offerId)
    .single();

  await serviceClient
    .from("assignment_offers")
    .update({ status: "offered" })
    .eq("id", offerId);

  if (updateError) return true;
  if ((updated ?? []).length === 0 && row?.status === "offered") return true;
  return false;
}

export { ASSIGNMENT_OFFERS_PHASE3C_SKIP };

const PAYMENT_EVENTS_PHASE4_SKIP =
  "5B-3 Phase 4a migration not applied (admin can still write payment_events). Apply supabase/migrations/20260518170000_rls_payment_events_bookings_admin_select_only.sql (e.g. supabase db reset).";

/**
 * Returns whether payment_events_admin_write was dropped (admin JWT cannot INSERT events).
 */
export async function isPaymentEventsRlsPhase4Applied(
  _serviceClient: SupabaseClient<Database>,
  adminUserClient: SupabaseClient<Database>,
  paymentId: string,
): Promise<boolean> {
  const { data, error } = await adminUserClient
    .from("payment_events")
    .insert({
      payment_id: paymentId,
      provider_event_id: `rls_probe_${Date.now()}_admin_blocked`,
      event_type: "rls_probe",
      payload: {},
    })
    .select("id");

  if (error) return true;
  if ((data ?? []).length === 0) return true;
  return false;
}

export { PAYMENT_EVENTS_PHASE4_SKIP };

const BOOKINGS_PHASE4_SKIP =
  "5B-3 Phase 4a migration not applied (admin can still write bookings). Apply supabase/migrations/20260518170000_rls_payment_events_bookings_admin_select_only.sql (e.g. supabase db reset).";

/**
 * Returns whether bookings_admin_write was dropped (admin JWT cannot UPDATE booking fields).
 */
export async function isBookingsRlsPhase4Applied(
  serviceClient: SupabaseClient<Database>,
  adminUserClient: SupabaseClient<Database>,
  bookingId: string,
): Promise<boolean> {
  const { data: before } = await serviceClient
    .from("bookings")
    .select("price_cents")
    .eq("id", bookingId)
    .single();

  const probePrice = (before?.price_cents ?? 0) + 1;

  const { data: updated, error: updateError } = await adminUserClient
    .from("bookings")
    .update({ price_cents: probePrice })
    .eq("id", bookingId)
    .select("price_cents");

  const { data: after } = await serviceClient
    .from("bookings")
    .select("price_cents")
    .eq("id", bookingId)
    .single();

  if (updateError) return true;
  if ((updated ?? []).length === 0 && after?.price_cents === before?.price_cents) return true;
  return false;
}

export { BOOKINGS_PHASE4_SKIP };

const NOTIFICATION_OUTBOX_PHASE5F_SKIP =
  "5F-a migration not applied (admin can still write notification_outbox). Apply supabase/migrations/20260518200000_rls_notification_outbox_admin_select_only.sql (e.g. supabase db reset).";

/**
 * Returns whether notification_outbox_admin was dropped (admin JWT cannot UPDATE outbox status).
 */
export async function isNotificationOutboxRlsPhase5fApplied(
  serviceClient: SupabaseClient<Database>,
  adminUserClient: SupabaseClient<Database>,
  outboxId: string,
): Promise<boolean> {
  await serviceClient
    .from("notification_outbox")
    .update({ status: "failed" })
    .eq("id", outboxId);

  const { data: updated, error: updateError } = await adminUserClient
    .from("notification_outbox")
    .update({ status: "sent" })
    .eq("id", outboxId)
    .select("status");

  const { data: row } = await serviceClient
    .from("notification_outbox")
    .select("status")
    .eq("id", outboxId)
    .single();

  await serviceClient
    .from("notification_outbox")
    .update({ status: "failed" })
    .eq("id", outboxId);

  if (updateError) return true;
  if ((updated ?? []).length === 0 && row?.status === "failed") return true;
  return false;
}

export { NOTIFICATION_OUTBOX_PHASE5F_SKIP };

export function createUserScopedClient(
  url: string,
  anonKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensurePhase2AuthPassword(
  serviceClient: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { error } = await serviceClient.auth.admin.updateUserById(userId, {
    password: PHASE2_TEST_PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(postgrestErrorText(error));
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
    await ensurePhase2AuthPassword(serviceClient, found.id);
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
  await ensurePhase2AuthPassword(serviceClient, profileId);
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

const phase2SignedInClientsByEmail = new Map<string, SupabaseClient<Database>>();

export function clearPhase2SignedInClients(): void {
  phase2SignedInClientsByEmail.clear();
}

/** One signed-in client per email per process — avoids Supabase Auth rate limits in long RLS suites. */
export async function getSignedInPhase2Client(
  url: string,
  anonKey: string,
  email: string,
): Promise<SupabaseClient<Database>> {
  const cached = phase2SignedInClientsByEmail.get(email);
  if (cached) return cached;

  const client = createUserScopedClient(url, anonKey);
  await signInAs(client, email);
  phase2SignedInClientsByEmail.set(email, client);
  return client;
}

export async function signInAs(
  client: SupabaseClient<Database>,
  email: string,
): Promise<void> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await client.auth.signInWithPassword({
      email,
      password: PHASE2_TEST_PASSWORD,
    });
    if (!error) return;

    const isRateLimited = /rate limit/i.test(error.message);
    if (!isRateLimited || attempt === maxAttempts) {
      throw new Error(error.message);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
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
    .select("id, profile_id, phone")
    .like("phone", `${PHASE2_TEST_PREFIX}%`);

  for (const cleaner of cleaners ?? []) {
    if (!cleaner.phone?.includes(marker)) continue;
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
