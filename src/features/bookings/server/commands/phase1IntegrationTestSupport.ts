import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

export type PostgrestErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type Phase1PreflightResult =
  | { shouldRun: true; client: SupabaseClient<Database> }
  | { shouldRun: false; skipReason: string };

/** Prefix for all Phase 1 integration test references (idempotency keys, markers). */
export const PHASE1_TEST_PREFIX = "test_phase1_";

export type Phase1IntegrationGate =
  | {
      shouldRun: true;
      url: string;
      serviceRoleKey: string;
      isRemote: boolean;
    }
  | {
      shouldRun: false;
      skipReason: string;
    };

export function isLocalSupabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return false;
  }
}

function readSupabaseCredentials(): { url: string; serviceRoleKey: string } | null {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  if (!url?.trim() || !serviceRoleKey?.trim()) return null;
  return { url: url.trim(), serviceRoleKey: serviceRoleKey.trim() };
}

function remoteOptInEnabled(): boolean {
  return process.env.BOOKING_COMMAND_RUN_REMOTE_INTEGRATION === "true";
}

/**
 * Decides whether Phase 1 Supabase integration tests should run.
 * Remote URLs require BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true.
 */
export function resolvePhase1IntegrationGate(): Phase1IntegrationGate {
  const creds = readSupabaseCredentials();
  if (!creds) {
    return {
      shouldRun: false,
      skipReason:
        "Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY to run Supabase integration tests.",
    };
  }

  const isRemote = !isLocalSupabaseUrl(creds.url);
  if (isRemote && !remoteOptInEnabled()) {
    return {
      shouldRun: false,
      skipReason:
        "Remote Supabase detected. Set BOOKING_COMMAND_RUN_REMOTE_INTEGRATION=true to opt in to write integration tests against a hosted project.",
    };
  }

  return {
    shouldRun: true,
    url: creds.url,
    serviceRoleKey: creds.serviceRoleKey,
    isRemote,
  };
}

export function createPhase1RunId(): string {
  return `${PHASE1_TEST_PREFIX}${crypto.randomUUID()}`;
}

export function phase1CompanyName(runId: string): string {
  return runId.startsWith(PHASE1_TEST_PREFIX) ? runId : `${PHASE1_TEST_PREFIX}${runId}`;
}

/** Allowed project domain for remote Supabase Auth (must match project email policy). */
export const PHASE1_TEST_EMAIL_DOMAIN = "shalean.co.za";

/** Persistent integration seed customer (preserved across test runs). */
export const PHASE1_INTEGRATION_SEED_COMPANY_NAME = `${PHASE1_TEST_PREFIX}integration_seed`;

export const PHASE1_INTEGRATION_SEED_EMAIL = `${PHASE1_INTEGRATION_SEED_COMPANY_NAME}@${PHASE1_TEST_EMAIL_DOMAIN}`;

export function getSeededIntegrationCustomerId(): string | null {
  return process.env.BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID?.trim() || null;
}

export function isPreservedIntegrationCustomer(customerId: string): boolean {
  const seededId = getSeededIntegrationCustomerId();
  return seededId !== null && seededId === customerId;
}

export function phase1AuthEmail(runId: string): string {
  const slug = runId.replace(PHASE1_TEST_PREFIX, "").slice(0, 36);
  return `${PHASE1_TEST_PREFIX}${slug}@${PHASE1_TEST_EMAIL_DOMAIN}`;
}

type AuthAdminErrorLike = {
  message?: string;
  status?: number | string;
  code?: string;
};

export function formatAuthAdminError(error: AuthAdminErrorLike, email: string): string {
  const parts = [
    error.message?.trim(),
    error.status != null ? `status=${error.status}` : null,
    error.code ? `code=${error.code}` : null,
  ].filter((part): part is string => Boolean(part));
  const detail = parts.length > 0 ? parts.join(" — ") : "unknown auth error";
  return (
    `Failed to create or locate auth user (${email}): ${detail}. ` +
    `Apply migration 20260516150000_auth_profile_bootstrap.sql (supabase db push). ` +
    `Or set BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID to an existing test_phase1_ customer.`
  );
}

/**
 * Optional bypass when auth.admin.createUser fails: reuse a seeded test customer row.
 * Must reference customers.company_name starting with test_phase1_.
 */
/**
 * Ensures a persistent test_phase1_integration_seed customer exists (no new auth user if an
 * orphan profile or existing test_phase1_ customer can be reused).
 */
export async function ensurePhase1IntegrationSeedCustomer(
  client: SupabaseClient<Database>,
): Promise<{ customerId: string; profileId: string }> {
  const companyName = PHASE1_INTEGRATION_SEED_COMPANY_NAME;

  const { data: seedRow, error: seedErr } = await client
    .from("customers")
    .select("id, profile_id")
    .eq("company_name", companyName)
    .maybeSingle();
  if (seedErr) throw new Error(seedErr.message);
  if (seedRow) return { customerId: seedRow.id, profileId: seedRow.profile_id };

  const { data: anyTestRows, error: anyErr } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .like("company_name", `${PHASE1_TEST_PREFIX}%`)
    .limit(1);
  if (anyErr) throw new Error(anyErr.message);
  const anyTest = anyTestRows?.[0];
  if (anyTest) {
    return { customerId: anyTest.id, profileId: anyTest.profile_id };
  }

  const { data: profiles, error: profErr } = await client
    .from("profiles")
    .select("id")
    .eq("role", "customer")
    .limit(100);
  if (profErr) throw new Error(profErr.message);

  for (const profile of profiles ?? []) {
    const { data: linked } = await client
      .from("customers")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (linked) continue;

    const { data: created, error: createErr } = await client
      .from("customers")
      .insert({ profile_id: profile.id, company_name: companyName })
      .select("id")
      .single();
    if (createErr) throw new Error(createErr.message);
    return { customerId: created.id, profileId: profile.id };
  }

  let profileId: string | null = await findPhase1AuthUserIdByEmail(
    client,
    PHASE1_INTEGRATION_SEED_EMAIL,
  );

  if (!profileId) {
    const createResult = await client.auth.admin.createUser({
      email: PHASE1_INTEGRATION_SEED_EMAIL,
      password: "integration-test-password",
      email_confirm: true,
      user_metadata: {
        phase1_integration: true,
        role: "customer",
        full_name: "Phase 1 integration seed",
      },
    });
    if (createResult.data.user) {
      profileId = createResult.data.user.id;
    } else if (createResult.error) {
      throw new Error(formatAuthAdminError(createResult.error, PHASE1_INTEGRATION_SEED_EMAIL));
    }
  }

  if (!profileId) {
    throw new Error(
      "Could not create integration seed customer: no orphan profile and auth user creation failed.",
    );
  }

  await client.from("profiles").upsert(
    {
      id: profileId,
      role: "customer",
      full_name: "Phase 1 integration seed",
    },
    { onConflict: "id" },
  );

  const { data: customer, error: customerError } = await client
    .from("customers")
    .insert({ profile_id: profileId, company_name: companyName })
    .select("id")
    .single();
  if (customerError) throw new Error(customerError.message);

  return { customerId: customer.id, profileId };
}

export async function resolveSeededIntegrationCustomer(
  client: SupabaseClient<Database>,
): Promise<{ customerId: string; profileId: string } | null> {
  const seededId = getSeededIntegrationCustomerId();
  if (!seededId) return null;

  const { data: customer, error } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("id", seededId)
    .maybeSingle();

  if (error) {
    throw new Error(`BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID lookup failed: ${error.message}`);
  }
  if (!customer) {
    throw new Error(`BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID not found: ${seededId}`);
  }
  if (!customer.company_name?.startsWith(PHASE1_TEST_PREFIX)) {
    throw new Error(
      "BOOKING_COMMAND_INTEGRATION_CUSTOMER_ID must reference a customer with company_name test_phase1_*.",
    );
  }

  return { customerId: customer.id, profileId: customer.profile_id };
}

/** Locates a prior Phase 1 integration auth user by exact email (paginated list). */
export async function findPhase1AuthUserIdByEmail(
  client: SupabaseClient<Database>,
  email: string,
): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const match = (data.users ?? []).find((u) => u.email === email);
    if (match) return match.id;

    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }

  return null;
}

/**
 * Creates (or reuses) auth user, profile, and customer rows for one integration run.
 */
export async function provisionPhase1IntegrationCustomer(
  client: SupabaseClient<Database>,
  runId: string,
): Promise<{ customerId: string; profileId: string } | { error: string }> {
  try {
    const seeded = await resolveSeededIntegrationCustomer(client);
    if (seeded) return seeded;
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  const email = phase1AuthEmail(runId);
  const companyName = phase1CompanyName(runId);

  const { data: existingCustomer } = await client
    .from("customers")
    .select("id, profile_id")
    .eq("company_name", companyName)
    .maybeSingle();

  if (existingCustomer) {
    return {
      customerId: existingCustomer.id,
      profileId: existingCustomer.profile_id,
    };
  }

  let profileId: string | null = null;

  const createResult = await client.auth.admin.createUser({
    email,
    password: "integration-test-password",
    email_confirm: true,
    user_metadata: { phase1_integration: true, run_id: runId },
  });

  if (createResult.data.user) {
    profileId = createResult.data.user.id;
  } else if (createResult.error) {
    profileId = await findPhase1AuthUserIdByEmail(client, email);
    if (!profileId) {
      return { error: formatAuthAdminError(createResult.error, email) };
    }
  } else {
    return { error: `Auth admin createUser returned no user for ${email}.` };
  }

  const { error: profileError } = await client.from("profiles").upsert(
    {
      id: profileId,
      role: "customer",
      full_name: `${runId} integration customer`,
    },
    { onConflict: "id" },
  );
  if (profileError) {
    return { error: `Failed to upsert profile: ${postgrestErrorText(profileError)}` };
  }

  const { data: customer, error: customerError } = await client
    .from("customers")
    .insert({
      profile_id: profileId,
      company_name: companyName,
    })
    .select("id")
    .single();

  if (customerError) {
    if (customerError.code === "23505") {
      const { data: retryCustomer } = await client
        .from("customers")
        .select("id, profile_id")
        .eq("company_name", companyName)
        .maybeSingle();
      if (retryCustomer) {
        return { customerId: retryCustomer.id, profileId: retryCustomer.profile_id };
      }
    }
    return { error: `Failed to create customer: ${postgrestErrorText(customerError)}` };
  }

  if (!customer) {
    return { error: "Failed to create customer: no row returned." };
  }

  return { customerId: customer.id, profileId };
}

export function phase1PaymentKey(suffix: string): string {
  return `${PHASE1_TEST_PREFIX}pay_${suffix}`;
}

export function phase1EventKey(suffix: string): string {
  return `${PHASE1_TEST_PREFIX}evt_${suffix}`;
}

export function phase1BookingMetadata(runId: string): Record<string, string> {
  return { test_phase1_run_id: runId };
}

type SupabaseJwtPayload = {
  role?: string;
  iss?: string;
};

/** Decodes the `role` claim from a Supabase JWT (no signature verification). */
export function decodeSupabaseJwtRole(apiKey: string): string | null {
  const token = apiKey.trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as SupabaseJwtPayload;
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Ensures the configured key is a Supabase service_role JWT (not anon/publishable).
 */
export function assertServiceRoleKey(serviceRoleKey: string): void {
  const role = decodeSupabaseJwtRole(serviceRoleKey);

  if (!role) {
    if (
      serviceRoleKey.startsWith("sb_publishable_") ||
      serviceRoleKey.startsWith("sb_anon_")
    ) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not a service_role key.");
    }
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not a valid Supabase JWT (expected service_role).",
    );
  }

  if (role === "anon") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not a service_role key.");
  }

  if (role !== "service_role") {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY must be a service_role key (JWT role claim is "${role}").`,
    );
  }
}

export function postgrestErrorText(error: PostgrestErrorLike): string {
  const parts = [
    error.message?.trim(),
    error.details?.trim(),
    error.hint?.trim(),
    error.code ? `code=${error.code}` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" — ") : "unknown PostgREST error";
}

export function formatApplicationAccessError(error: PostgrestErrorLike): string {
  const text = postgrestErrorText(error).toLowerCase();
  const code = error.code ?? "";

  if (
    text.includes("permission denied") ||
    code === "42501" ||
    text.includes("insufficient_privilege")
  ) {
    return (
      "Service role JWT is valid but cannot access application tables (e.g. public.customers). " +
      "Apply migrations to this project (supabase db push) including api_role_grants, and confirm " +
      "SUPABASE_SERVICE_ROLE_KEY is the service_role secret from Project Settings → API—not anon or publishable."
    );
  }

  if (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    code === "PGRST205" ||
    code === "42P01"
  ) {
    return (
      "Application schema is missing on this project. Link the project and run supabase db push before integration tests."
    );
  }

  return `Cannot access application schema (${postgrestErrorText(error)}).`;
}

export async function runPhase1IntegrationPreflight(
  url: string,
  serviceRoleKey: string,
): Promise<Phase1PreflightResult> {
  try {
    const client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await assertSupabaseReachable(client, serviceRoleKey);
    return { shouldRun: true, client };
  } catch (e) {
    const skipReason = e instanceof Error ? e.message : String(e);
    return { shouldRun: false, skipReason };
  }
}

/**
 * Validates service_role credentials, Auth Admin API reachability, and PostgREST
 * access to application tables required by booking command integration tests.
 */
export async function assertSupabaseReachable(
  client: SupabaseClient<Database>,
  serviceRoleKey: string,
): Promise<void> {
  assertServiceRoleKey(serviceRoleKey);

  const { error: authError } = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (authError) {
    throw new Error(
      `Supabase is not reachable with service role (auth admin): ${authError.message}`,
    );
  }

  const { error: schemaError } = await client.from("customers").select("id").limit(1);
  if (schemaError) {
    throw new Error(formatApplicationAccessError(schemaError));
  }

  const { error: paymentsSchemaError } = await client
    .from("payments")
    .select("id, payment_link_expires_at")
    .limit(0);
  if (paymentsSchemaError) {
    const msg = paymentsSchemaError.message ?? "";
    if (msg.includes("payment_link_expires_at")) {
      throw new Error(
        "Phase 7 schema missing on remote: apply migration 20260516190000_booking_payment_lock.sql (run: supabase db push).",
      );
    }
    throw new Error(formatApplicationAccessError(paymentsSchemaError));
  }

  const { error: locksSchemaError } = await client
    .from("booking_locks")
    .select("id")
    .limit(0);
  if (locksSchemaError) {
    const msg = locksSchemaError.message ?? "";
    if (msg.includes("booking_locks") || msg.includes("schema cache")) {
      throw new Error(
        "Phase 7 schema missing on remote: apply migration 20260516190000_booking_payment_lock.sql (run: supabase db push).",
      );
    }
    throw new Error(formatApplicationAccessError(locksSchemaError));
  }
}

/** Returns true when PostgREST reports insufficient privilege on public tables. */
export function isPostgrestPermissionDenied(message: string): boolean {
  return message.toLowerCase().includes("permission denied");
}

/**
 * Removes only rows created by Phase 1 integration tests for the given run id
 * (or any run id prefixed with test_phase1_ when runId is omitted for stale sweep).
 */
/**
 * Removes bookings (and related rows) for a test run on a customer without deleting the customer.
 */
export async function cleanupPhase1TestRunBookings(
  client: SupabaseClient<Database>,
  customerId: string,
  runId: string,
): Promise<void> {
  if (isPreservedIntegrationCustomer(customerId)) {
    const { data: bookings, error } = await client
      .from("bookings")
      .select("id, metadata")
      .eq("customer_id", customerId);
    if (error) throw new Error(error.message);

    const bookingIds = (bookings ?? [])
      .filter((b) => {
        const meta = b.metadata as Record<string, unknown> | null;
        return meta?.test_phase1_run_id === runId;
      })
      .map((b) => b.id);

    if (bookingIds.length === 0) return;

    await client.from("earning_lines").delete().in("booking_id", bookingIds);
    await client.from("assignment_offers").delete().in("booking_id", bookingIds);
    await client.from("payments").delete().in("booking_id", bookingIds);
    await client.from("bookings").delete().in("id", bookingIds);
    return;
  }

  await cleanupPhase1TestRun(client, runId);
}

export async function cleanupPhase1TestRun(
  client: SupabaseClient<Database>,
  runId: string,
): Promise<void> {
  const companyName = phase1CompanyName(runId);

  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id, profile_id")
    .eq("company_name", companyName);
  if (custErr) throw new Error(custErr.message);

  for (const customer of customers ?? []) {
    if (isPreservedIntegrationCustomer(customer.id)) continue;
    await cleanupPhase1CustomerTree(client, customer.id, customer.profile_id);
  }
}

/**
 * Idempotent sweep of orphaned Phase 1 test customers (failed prior runs).
 * Only touches rows whose company_name starts with test_phase1_.
 */
/**
 * Removes orphaned test auth users by email prefix (no public table reads).
 * Booking rows must already be gone (customer delete is restrict).
 */
async function cleanupStalePhase1AuthUsers(
  client: SupabaseClient<Database>,
): Promise<void> {
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const users = data.users ?? [];
    for (const user of users) {
      const email = user.email ?? "";
      if (!email.startsWith(PHASE1_TEST_PREFIX)) continue;
      if (email === PHASE1_INTEGRATION_SEED_EMAIL) continue;
      const { error: delErr } = await client.auth.admin.deleteUser(user.id);
      if (delErr && !delErr.message.toLowerCase().includes("not found")) {
        throw new Error(delErr.message);
      }
    }

    if (users.length < perPage) break;
    page += 1;
  }
}

export async function cleanupStalePhase1TestData(
  client: SupabaseClient<Database>,
): Promise<void> {
  const { data: customers, error } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .like("company_name", `${PHASE1_TEST_PREFIX}%`);

  if (error) {
    if (isPostgrestPermissionDenied(error.message)) {
      await cleanupStalePhase1AuthUsers(client);
      return;
    }
    throw new Error(error.message);
  }

  for (const customer of customers ?? []) {
    if (!customer.company_name?.startsWith(PHASE1_TEST_PREFIX)) continue;
    if (
      customer.company_name === PHASE1_INTEGRATION_SEED_COMPANY_NAME ||
      isPreservedIntegrationCustomer(customer.id)
    ) {
      continue;
    }
    await cleanupPhase1CustomerTree(client, customer.id, customer.profile_id);
  }

  await cleanupStalePhase1AuthUsers(client);
}

async function cleanupPhase1CustomerTree(
  client: SupabaseClient<Database>,
  customerId: string,
  profileId: string,
): Promise<void> {
  const { data: bookings, error: bookErr } = await client
    .from("bookings")
    .select("id")
    .eq("customer_id", customerId);
  if (bookErr) throw new Error(bookErr.message);

  const bookingIds = (bookings ?? []).map((b) => b.id);

  if (bookingIds.length > 0) {
    await client.from("earning_lines").delete().in("booking_id", bookingIds);
    await client.from("assignment_offers").delete().in("booking_id", bookingIds);
    await client.from("payments").delete().in("booking_id", bookingIds);
    await client.from("bookings").delete().in("id", bookingIds);
  }

  await client.from("notification_outbox").delete().eq("recipient", customerId);

  await client.from("customers").delete().eq("id", customerId);
  await client.from("profiles").delete().eq("id", profileId);

  const { error: authErr } = await client.auth.admin.deleteUser(profileId);
  if (authErr && !authErr.message.toLowerCase().includes("not found")) {
    throw new Error(authErr.message);
  }
}
