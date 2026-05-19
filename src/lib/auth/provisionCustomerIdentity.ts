import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/lib/database/types";
import { findAuthUserByEmail } from "@/lib/auth/provisionCleanerIdentity";

export type ProvisionCustomerIdentityParams = {
  authEmail: string;
  fullName: string;
  companyName?: string | null;
  phoneE164?: string | null;
  notes?: string | null;
};

export type ProvisionCustomerIdentitySuccess = {
  ok: true;
  customerId: string;
  profileId: string;
  email: string;
  createdAuthUser: boolean;
  createdProfile: boolean;
  createdCustomer: boolean;
  warnings: string[];
};

export type ProvisionCustomerIdentityFailure = {
  ok: false;
  code: string;
  message: string;
};

export type ProvisionCustomerIdentityResult =
  | ProvisionCustomerIdentitySuccess
  | ProvisionCustomerIdentityFailure;

function generateInternalPassword(): string {
  return randomBytes(32).toString("base64url");
}

function isDuplicateAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("duplicate") ||
    lower.includes("user already exists")
  );
}

async function loadProfile(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<{ role: UserRole | null; full_name: string | null } | null> {
  const { data, error } = await client
    .from("profiles")
    .select("role, full_name")
    .eq("id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    role: (data.role as UserRole | undefined) ?? null,
    full_name: data.full_name,
  };
}

async function findCleanerByProfileId(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from("cleaners")
    .select("id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function findCustomerByProfileId(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<{
  id: string;
  company_name: string | null;
  phone: string | null;
  notes: string | null;
} | null> {
  const { data, error } = await client
    .from("customers")
    .select("id, company_name, phone, notes")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteAuthUser(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<void> {
  const { error } = await client.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);
}

function resolveCompanyName(
  input: string | null | undefined,
  fullName: string,
  email: string,
): string {
  const trimmed = input?.trim();
  if (trimmed) return trimmed;
  if (fullName) return fullName;
  return email.split("@")[0] || "Customer";
}

/**
 * Ensures auth.users + public.profiles (role=customer) + public.customers for admin provisioning.
 * Never creates cleaner rows or admin profiles. Service-role callers only.
 */
export async function provisionCustomerIdentity(
  client: SupabaseClient<Database>,
  params: ProvisionCustomerIdentityParams,
): Promise<ProvisionCustomerIdentityResult> {
  const email = params.authEmail.trim().toLowerCase();
  const fullName = params.fullName.trim();
  const companyName = resolveCompanyName(params.companyName, fullName, email);
  const phoneE164 = params.phoneE164?.trim() ? params.phoneE164.trim() : null;
  const notes = params.notes?.trim() ? params.notes.trim() : null;
  const warnings: string[] = [];

  if (!email || !fullName) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Email and full name are required.",
    };
  }

  let createdAuthUser = false;
  let createdProfile = false;
  let createdCustomer = false;
  let profileId: string;

  const existingAuth = await findAuthUserByEmail(client, email);

  if (existingAuth) {
    profileId = existingAuth.id;

    const existingProfile = await loadProfile(client, profileId);
    if (existingProfile?.role === "admin") {
      return {
        ok: false,
        code: "ROLE_CONFLICT",
        message: "This email belongs to an admin account and cannot be used for a customer.",
      };
    }

    const cleanerRow = await findCleanerByProfileId(client, profileId);
    if (existingProfile?.role === "cleaner" || cleanerRow) {
      return {
        ok: false,
        code: "ROLE_CONFLICT",
        message: "This email belongs to a cleaner account and cannot be used for a customer.",
      };
    }

    const existingCustomer = await findCustomerByProfileId(client, profileId);
    if (existingCustomer) {
      if (existingProfile?.role !== "customer") {
        return {
          ok: false,
          code: "PROVISION_FAILED",
          message: "Customer row exists but profile role is not customer. Ops review required.",
        };
      }

      warnings.push("Customer already exists");

      return {
        ok: true,
        customerId: existingCustomer.id,
        profileId,
        email,
        createdAuthUser: false,
        createdProfile: false,
        createdCustomer: false,
        warnings,
      };
    }
  } else {
    const created = await client.auth.admin.createUser({
      email,
      password: generateInternalPassword(),
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created.error || !created.data.user) {
      const message = created.error?.message ?? "Failed to create auth user.";
      if (isDuplicateAuthError(message)) {
        return {
          ok: false,
          code: "EMAIL_ALREADY_REGISTERED",
          message: "This email is already registered.",
        };
      }
      return { ok: false, code: "AUTH_CREATE_FAILED", message };
    }

    profileId = created.data.user.id;
    createdAuthUser = true;
  }

  try {
    const profileBefore = await loadProfile(client, profileId);
    if (!profileBefore) {
      const { error: profileInsertError } = await client.from("profiles").insert({
        id: profileId,
        role: "customer",
        full_name: fullName,
      });
      if (profileInsertError) {
        throw new Error(profileInsertError.message);
      }
      createdProfile = true;
    } else {
      const { error: profileUpsertError } = await client.from("profiles").upsert(
        { id: profileId, role: "customer", full_name: fullName },
        { onConflict: "id" },
      );
      if (profileUpsertError) {
        throw new Error(profileUpsertError.message);
      }
      if (profileBefore.role !== "customer") {
        createdProfile = true;
      }
    }

    const customerBefore = await findCustomerByProfileId(client, profileId);
    const { data: provisionedCustomerId, error: provisionError } = await client.rpc(
      "ensure_customer_provisioned",
      { profile_id: profileId },
    );
    if (provisionError) {
      throw new Error(provisionError.message);
    }
    if (!provisionedCustomerId) {
      throw new Error("Failed to provision customers row for profile.");
    }

    if (!customerBefore) {
      createdCustomer = true;
    }

    const customerPatch: {
      company_name: string;
      phone?: string | null;
      notes?: string | null;
    } = { company_name: companyName };
    if (phoneE164 !== null) customerPatch.phone = phoneE164;
    if (notes !== null) customerPatch.notes = notes;

    const { error: customerUpdateError } = await client
      .from("customers")
      .update(customerPatch)
      .eq("id", provisionedCustomerId);
    if (customerUpdateError) {
      throw new Error(customerUpdateError.message);
    }

    const cleanerAfter = await findCleanerByProfileId(client, profileId);
    if (cleanerAfter) {
      throw new Error("Unexpected cleaners row after customer provisioning.");
    }

    return {
      ok: true,
      customerId: provisionedCustomerId,
      profileId,
      email,
      createdAuthUser,
      createdProfile,
      createdCustomer,
      warnings,
    };
  } catch (error) {
    if (createdAuthUser) {
      await deleteAuthUser(client, profileId);
    }
    const message =
      error instanceof Error ? error.message : "Failed to provision customer identity.";
    return { ok: false, code: "PROVISION_FAILED", message };
  }
}
