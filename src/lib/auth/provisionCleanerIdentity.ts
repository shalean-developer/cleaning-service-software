import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database/types";

export type ProvisionCleanerIdentityParams = {
  authEmail: string;
  fullName: string;
  phoneE164: string;
  password: string;
};

export type ProvisionCleanerIdentitySuccess = {
  ok: true;
  profileId: string;
  cleanerId: string;
  createdAuthUser: boolean;
};

export type ProvisionCleanerIdentityFailure = {
  ok: false;
  code: string;
  message: string;
};

export type ProvisionCleanerIdentityResult =
  | ProvisionCleanerIdentitySuccess
  | ProvisionCleanerIdentityFailure;

function isDuplicateAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("duplicate") ||
    lower.includes("user already exists")
  );
}

/** Paginated lookup by auth email (service-role only). */
export async function findAuthUserByEmail(
  client: SupabaseClient<Database>,
  email: string,
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  let page = 1;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = (data.users ?? []).find((u) => u.email?.trim().toLowerCase() === target);
    if (match) return match;
    if ((data.users ?? []).length < 200) break;
    page += 1;
  }

  return null;
}

async function loadProfileRole(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<UserRole | null> {
  const { data, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.role as UserRole | undefined) ?? null;
}

async function findCleanerByProfileId(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<{ id: string; profile_id: string; phone: string | null } | null> {
  const { data, error } = await client
    .from("cleaners")
    .select("id, profile_id, phone")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findCleanerByPhone(
  client: SupabaseClient<Database>,
  phoneE164: string,
): Promise<{ id: string; profile_id: string; phone: string | null } | null> {
  const { data, error } = await client
    .from("cleaners")
    .select("id, profile_id, phone")
    .eq("phone", phoneE164)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function deleteAuthUser(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<void> {
  const { error } = await client.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);
}

/**
 * Ensures auth.users + public.profiles (role=cleaner) + public.cleaners for admin provisioning.
 * Never creates or promotes admin profiles. Service-role callers only.
 */
export async function provisionCleanerIdentity(
  client: SupabaseClient<Database>,
  params: ProvisionCleanerIdentityParams,
): Promise<ProvisionCleanerIdentityResult> {
  const authEmail = params.authEmail.trim().toLowerCase();
  const fullName = params.fullName.trim();
  const phoneE164 = params.phoneE164;

  const cleanerByPhone = await findCleanerByPhone(client, phoneE164);
  if (cleanerByPhone) {
    return {
      ok: false,
      code: "PHONE_ALREADY_REGISTERED",
      message: "A cleaner with this phone number already exists.",
    };
  }

  let createdAuthUser = false;
  let profileId: string;

  const existingAuth = await findAuthUserByEmail(client, authEmail);

  if (existingAuth) {
    profileId = existingAuth.id;

    const existingRole = await loadProfileRole(client, profileId);
    if (existingRole === "admin") {
      return {
        ok: false,
        code: "EMAIL_ALREADY_REGISTERED",
        message: "This email is already registered and cannot be used for a cleaner account.",
      };
    }

    const cleanerByProfile = await findCleanerByProfileId(client, profileId);
    if (cleanerByProfile) {
      return {
        ok: false,
        code: "EMAIL_ALREADY_REGISTERED",
        message: "A cleaner account with this phone number already exists.",
      };
    }

    const { error: passwordError } = await client.auth.admin.updateUserById(profileId, {
      password: params.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (passwordError) {
      return {
        ok: false,
        code: "AUTH_UPDATE_FAILED",
        message: passwordError.message,
      };
    }
  } else {
    const created = await client.auth.admin.createUser({
      email: authEmail,
      password: params.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.error || !created.data.user) {
      const message = created.error?.message ?? "Failed to create auth user.";
      if (isDuplicateAuthError(message)) {
        return {
          ok: false,
          code: "EMAIL_ALREADY_REGISTERED",
          message: "A cleaner account with this phone number already exists.",
        };
      }
      return { ok: false, code: "AUTH_CREATE_FAILED", message };
    }

    profileId = created.data.user.id;
    createdAuthUser = true;
  }

  try {
    const { error: profileError } = await client.from("profiles").upsert(
      { id: profileId, role: "cleaner", full_name: fullName },
      { onConflict: "id" },
    );
    if (profileError) {
      throw new Error(profileError.message);
    }

    const { data: cleanerRow, error: cleanerError } = await client
      .from("cleaners")
      .insert({ profile_id: profileId, phone: phoneE164, active: false })
      .select("id")
      .single();
    if (cleanerError || !cleanerRow) {
      throw new Error(cleanerError?.message ?? "Failed to create cleaner row.");
    }

    return {
      ok: true,
      profileId,
      cleanerId: cleanerRow.id,
      createdAuthUser,
    };
  } catch (error) {
    if (createdAuthUser) {
      await deleteAuthUser(client, profileId);
    }
    const message =
      error instanceof Error ? error.message : "Failed to provision cleaner identity.";
    return { ok: false, code: "PROVISION_FAILED", message };
  }
}

/**
 * Repairs a cleaner auth user missing public.profiles and/or cleaners row.
 * Requires an existing cleaners row OR explicit cleaner repair (never promotes to admin).
 */
export async function repairCleanerAuthIdentity(
  client: SupabaseClient<Database>,
  params: {
    authEmail: string;
    fullName?: string;
    phoneE164?: string | null;
    /** When true, may create a cleaners row if auth exists without one. */
    allowCreateCleanerRow: boolean;
  },
): Promise<ProvisionCleanerIdentityResult> {
  const authEmail = params.authEmail.trim().toLowerCase();
  const user = await findAuthUserByEmail(client, authEmail);
  if (!user) {
    return {
      ok: false,
      code: "AUTH_USER_NOT_FOUND",
      message: `No auth user found for ${authEmail}`,
    };
  }

  const profileId = user.id;
  const existingRole = await loadProfileRole(client, profileId);
  if (existingRole === "admin") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Refusing to modify an admin auth account via cleaner repair.",
    };
  }

  const cleanerByProfile = await findCleanerByProfileId(client, profileId);
  if (!cleanerByProfile && !params.allowCreateCleanerRow) {
    return {
      ok: false,
      code: "NO_CLEANER_ROW",
      message:
        "No cleaners row for this auth user. Re-run with --cleaner to create profile + cleaners row.",
    };
  }

  if (params.phoneE164) {
    const cleanerByPhone = await findCleanerByPhone(client, params.phoneE164);
    if (cleanerByPhone && cleanerByPhone.profile_id !== profileId) {
      return {
        ok: false,
        code: "PHONE_ALREADY_REGISTERED",
        message: "Phone number is already assigned to another cleaner.",
      };
    }
  }

  const fullName =
    params.fullName?.trim() ||
    (typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "") ||
    authEmail.split("@")[0];

  const { error: profileError } = await client.from("profiles").upsert(
    { id: profileId, role: "cleaner", full_name: fullName },
    { onConflict: "id" },
  );
  if (profileError) {
    return { ok: false, code: "PROVISION_FAILED", message: profileError.message };
  }

  if (cleanerByProfile) {
    if (params.phoneE164 && cleanerByProfile.phone !== params.phoneE164) {
      const { error: phoneUpdateError } = await client
        .from("cleaners")
        .update({ phone: params.phoneE164 })
        .eq("id", cleanerByProfile.id);
      if (phoneUpdateError) {
        return { ok: false, code: "PROVISION_FAILED", message: phoneUpdateError.message };
      }
    }
    return {
      ok: true,
      profileId,
      cleanerId: cleanerByProfile.id,
      createdAuthUser: false,
    };
  }

  const { data: cleanerRow, error: cleanerError } = await client
    .from("cleaners")
    .insert({ profile_id: profileId, phone: params.phoneE164 ?? null, active: false })
    .select("id")
    .single();
  if (cleanerError || !cleanerRow) {
    return {
      ok: false,
      code: "PROVISION_FAILED",
      message: cleanerError?.message ?? "Failed to create cleaner row.",
    };
  }

  return {
    ok: true,
    profileId,
    cleanerId: cleanerRow.id,
    createdAuthUser: false,
  };
}
