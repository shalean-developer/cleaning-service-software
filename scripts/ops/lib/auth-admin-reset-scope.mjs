/**
 * Production-safe auth + admin profile reset.
 * Keeps only admin@shalean.co.za in auth.users and public.profiles (role=admin).
 */

export const PROTECTED_ADMIN_EMAIL = "admin@shalean.co.za";
export const PROTECTED_ADMIN_FULL_NAME = "Admin";
export const CONFIRM_ENV_VAR = "CONFIRM_RESET_AUTH_ADMIN";

const CHUNK = 100;

/**
 * @param {unknown} err
 */
export function formatSupabaseError(err) {
  if (err && typeof err === "object" && "message" in err) {
    const e = /** @type {{ message?: string; code?: string; details?: string }} */ (err);
    return [e.code, e.message, e.details].filter(Boolean).join(" — ");
  }
  return String(err);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function listAllAuthUsers(client) {
  /** @type {Array<{ id: string; email: string | null; created_at?: string }>} */
  const users = [];
  let page = 1;
  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const pageUsers = data.users ?? [];
    for (const user of pageUsers) {
      if (user.id) {
        users.push({
          id: user.id,
          email: user.email ?? null,
          created_at: user.created_at,
        });
      }
    }
    if (pageUsers.length < 200) break;
    page += 1;
  }
  return users;
}

/**
 * @param {Array<{ id: string; email: string | null }>} authUsers
 */
export function findProtectedAdminUser(authUsers) {
  const email = PROTECTED_ADMIN_EMAIL.toLowerCase();
  return authUsers.find((u) => (u.email ?? "").toLowerCase() === email) ?? null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function loadAllProfiles(client) {
  const { data, error } = await client.from("profiles").select("id, role, full_name, created_at");
  if (error) throw error;
  return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} profileIds
 */
async function countCustomersForProfiles(client, profileIds) {
  if (profileIds.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < profileIds.length; i += CHUNK) {
    const chunk = profileIds.slice(i, i + CHUNK);
    const { count, error } = await client
      .from("customers")
      .select("id", { count: "exact", head: true })
      .in("profile_id", chunk);
    if (error) throw error;
    total += count ?? 0;
  }
  return total;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} profileIds
 */
async function countCleanersForProfiles(client, profileIds) {
  if (profileIds.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < profileIds.length; i += CHUNK) {
    const chunk = profileIds.slice(i, i + CHUNK);
    const { count, error } = await client
      .from("cleaners")
      .select("id", { count: "exact", head: true })
      .in("profile_id", chunk);
    if (error) throw error;
    total += count ?? 0;
  }
  return total;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string[]} profileIds
 */
async function countBookingsForCustomerProfiles(client, profileIds) {
  if (profileIds.length === 0) return 0;

  const { data: customers, error: custErr } = await client
    .from("customers")
    .select("id")
    .in("profile_id", profileIds);
  if (custErr) throw custErr;

  const customerIds = (customers ?? []).map((c) => c.id);
  if (customerIds.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < customerIds.length; i += CHUNK) {
    const chunk = customerIds.slice(i, i + CHUNK);
    const { count, error } = await client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("customer_id", chunk);
    if (error) throw error;
    total += count ?? 0;
  }
  return total;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function collectAuthAdminResetCounts(client) {
  const authUsers = await listAllAuthUsers(client);
  const profiles = await loadAllProfiles(client);
  const protectedUser = findProtectedAdminUser(authUsers);

  const protectedProfile =
    protectedUser != null
      ? (profiles.find((p) => p.id === protectedUser.id) ?? null)
      : null;

  const authToDelete = protectedUser
    ? authUsers.filter((u) => u.id !== protectedUser.id)
    : authUsers;

  const profilesToDelete = protectedUser
    ? profiles.filter((p) => p.id !== protectedUser.id)
    : profiles;

  const profileIdsToDelete = profilesToDelete.map((p) => p.id);
  const customersLinked = await countCustomersForProfiles(client, profileIdsToDelete);
  const cleanersLinked = await countCleanersForProfiles(client, profileIdsToDelete);
  const bookingsBlocking = await countBookingsForCustomerProfiles(client, profileIdsToDelete);

  const profilesByRole = { admin: 0, customer: 0, cleaner: 0, other: 0 };
  for (const p of profiles) {
    if (p.role === "admin") profilesByRole.admin += 1;
    else if (p.role === "customer") profilesByRole.customer += 1;
    else if (p.role === "cleaner") profilesByRole.cleaner += 1;
    else profilesByRole.other += 1;
  }

  return {
    authUsers,
    profiles,
    protectedUser,
    protectedProfile,
    authToDelete,
    profilesToDelete,
    profilesByRole,
    customersLinked,
    cleanersLinked,
    bookingsBlocking,
  };
}

/**
 * @param {Awaited<ReturnType<typeof collectAuthAdminResetCounts>>} snapshot
 */
export function assertProtectedAdminReady(snapshot) {
  if (!snapshot.protectedUser) {
    throw new Error(
      `Protected admin ${PROTECTED_ADMIN_EMAIL} not found in auth.users — aborting. ` +
        "Create the account first (e.g. ops:provision-admin) before reset.",
    );
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} protectedUserId
 */
export async function ensureAdminProfile(client, protectedUserId) {
  const { data: existing, error: readErr } = await client
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", protectedUserId)
    .maybeSingle();
  if (readErr) throw readErr;

  const needsUpsert =
    !existing || existing.role !== "admin" || !existing.full_name?.trim();

  if (!needsUpsert) {
    return { created: false, updated: false, profile: existing };
  }

  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        id: protectedUserId,
        role: "admin",
        full_name: PROTECTED_ADMIN_FULL_NAME,
      },
      { onConflict: "id" },
    )
    .select("id, role, full_name")
    .single();
  if (error) throw error;

  return {
    created: !existing,
    updated: Boolean(existing),
    profile: data,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} protectedUserId
 */
export async function deleteNonAdminProfiles(client, protectedUserId) {
  const profiles = await loadAllProfiles(client);
  const targets = profiles.filter((p) => p.id !== protectedUserId);
  if (targets.length === 0) return 0;

  let deleted = 0;
  for (let i = 0; i < targets.length; i += CHUNK) {
    const chunk = targets.slice(i, i + CHUNK).map((p) => p.id);
    const { error } = await client.from("profiles").delete().in("id", chunk);
    if (error) throw error;
    deleted += chunk.length;
  }
  return deleted;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} protectedUserId
 * @param {Array<{ id: string; email: string | null }>} authUsers
 */
export async function deleteNonAdminAuthUsers(client, protectedUserId, authUsers) {
  const targets = authUsers.filter((u) => u.id !== protectedUserId);
  let deleted = 0;
  const failures = [];

  for (const user of targets) {
    const { error } = await client.auth.admin.deleteUser(user.id);
    if (error) {
      failures.push({ email: user.email ?? user.id, message: formatSupabaseError(error) });
      continue;
    }
    deleted += 1;
  }

  return { deleted, failures };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function executeAuthAdminReset(client) {
  const before = await collectAuthAdminResetCounts(client);
  assertProtectedAdminReady(before);

  const protectedId = before.protectedUser.id;
  const profileEnsure = await ensureAdminProfile(client, protectedId);

  if (before.bookingsBlocking > 0) {
    throw new Error(
      `${before.bookingsBlocking} booking(s) still reference customers on profiles slated for removal. ` +
        "Run ops:clear-operational-data first, then retry auth admin reset.",
    );
  }

  const profilesDeleted = await deleteNonAdminProfiles(client, protectedId);
  const { deleted: authDeleted, failures: authFailures } = await deleteNonAdminAuthUsers(
    client,
    protectedId,
    before.authUsers,
  );

  const after = await collectAuthAdminResetCounts(client);
  assertProtectedAdminReady(after);

  const adminProfile = await ensureAdminProfile(client, protectedId);

  return {
    before,
    after,
    profileEnsure,
    adminProfile,
    profilesDeleted,
    authDeleted,
    authFailures,
  };
}

/**
 * @param {Awaited<ReturnType<typeof collectAuthAdminResetCounts>>} snapshot
 */
export function formatAuthAdminResetReport(snapshot, label) {
  const lines = [
    `${label}`,
    `  Protected admin:              ${PROTECTED_ADMIN_EMAIL}`,
    `  Protected auth user exists:   ${snapshot.protectedUser ? "yes" : "NO"}`,
    `  Protected profile exists:     ${snapshot.protectedProfile ? "yes" : "no"}`,
    `  Protected profile role:       ${snapshot.protectedProfile?.role ?? "—"}`,
    "",
    "  auth.users total:             " + snapshot.authUsers.length,
    "  auth.users to delete:         " + snapshot.authToDelete.length,
    "  public.profiles total:        " + snapshot.profiles.length,
    "  public.profiles to delete:    " + snapshot.profilesToDelete.length,
    `    admin profiles (total):     ${snapshot.profilesByRole.admin}`,
    `    customer profiles:          ${snapshot.profilesByRole.customer}`,
    `    cleaner profiles:           ${snapshot.profilesByRole.cleaner}`,
    "",
    "  customers linked to removed profiles: " + snapshot.customersLinked,
    "  cleaners linked to removed profiles:  " + snapshot.cleanersLinked,
    "  bookings blocking profile delete:     " + snapshot.bookingsBlocking,
  ];

  if (snapshot.authToDelete.length > 0) {
    lines.push("", "  Sample auth users to delete (up to 15):");
    for (const u of snapshot.authToDelete.slice(0, 15)) {
      lines.push(`    ${u.email ?? "(no email)"}  ${u.id}`);
    }
    if (snapshot.authToDelete.length > 15) {
      lines.push(`    … and ${snapshot.authToDelete.length - 15} more`);
    }
  }

  if (snapshot.profilesToDelete.length > 0) {
    lines.push("", "  Sample profiles to delete (up to 15):");
    for (const p of snapshot.profilesToDelete.slice(0, 15)) {
      lines.push(`    ${p.role}  ${p.full_name ?? "—"}  ${p.id}`);
    }
    if (snapshot.profilesToDelete.length > 15) {
      lines.push(`    … and ${snapshot.profilesToDelete.length - 15} more`);
    }
  }

  return lines.join("\n");
}

/**
 * @param {Awaited<ReturnType<typeof collectAuthAdminResetCounts>>} after
 */
export function authAdminResetComplete(after) {
  return (
    after.authToDelete.length === 0 &&
    after.profilesToDelete.length === 0 &&
    after.protectedUser != null &&
    after.protectedProfile?.role === "admin"
  );
}
