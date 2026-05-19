import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { validateCleanerCreateForm } from "@/features/cleaners/admin/cleanerProfileFormValidation";
import { parseCreateCleanerBody } from "./parseCreateCleanerBody";
import { replaceCleanerAvailability } from "./replaceCleanerAvailability";
import { recordCleanerProfileAudit } from "./recordCleanerProfileAudit";
import type { CreateCleanerParams, CreateCleanerResult } from "./createCleanerTypes";

function isDuplicateAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("duplicate") ||
    lower.includes("user already exists")
  );
}

async function authEmailExists(
  client: SupabaseClient<Database>,
  email: string,
): Promise<boolean> {
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  const target = email.toLowerCase();
  return (data.users ?? []).some((u) => u.email?.toLowerCase() === target);
}

async function cleanerPhoneExists(
  client: SupabaseClient<Database>,
  phoneE164: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("cleaners")
    .select("id")
    .eq("phone", phoneE164)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function deleteAuthUser(
  client: SupabaseClient<Database>,
  profileId: string,
): Promise<void> {
  const { error } = await client.auth.admin.deleteUser(profileId);
  if (error) throw new Error(error.message);
}

async function purgeCleanerChildRows(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<void> {
  await client.from("cleaner_availability").delete().eq("cleaner_id", cleanerId);
  await client.from("cleaner_service_areas").delete().eq("cleaner_id", cleanerId);
  await client
    .from("cleaner_service_capabilities")
    .delete()
    .eq("cleaner_id", cleanerId);
}

export async function createCleaner(
  params: CreateCleanerParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CreateCleanerResult> {
  const parsed = parseCreateCleanerBody({
    fullName: params.fullName,
    phone: params.phone,
    password: params.password,
    confirmPassword: params.confirmPassword,
    serviceAreasInput: params.serviceAreasInput,
    capabilities: params.capabilities,
    workingDays: params.workingDays,
    startTime: params.startTime,
    endTime: params.endTime,
    timezone: params.timezone,
    idempotencyKey: params.idempotencyKey,
  });

  if (!parsed.ok) {
    return { ok: false, code: parsed.code, message: parsed.message };
  }

  const { values } = parsed;
  const validation = validateCleanerCreateForm(values);
  const phoneE164 = validation.phoneE164;
  const authEmail = validation.generatedAuthEmail;

  if (!validation.valid || !phoneE164 || !authEmail) {
    const firstError =
      validation.errors.fullName ??
      validation.errors.phone ??
      validation.errors.password ??
      validation.errors.confirmPassword ??
      validation.errors.capabilities ??
      validation.errors.serviceAreasInput ??
      "Invalid cleaner profile payload.";
    return { ok: false, code: "INVALID_PAYLOAD", message: firstError };
  }

  const serviceAreaSlugs = validation.serviceAreaSlugs;
  const availabilityWindows = validation.availabilityWindows;
  const fullName = values.fullName.trim();

  try {
    if (await authEmailExists(client, authEmail)) {
      return {
        ok: false,
        code: "EMAIL_ALREADY_REGISTERED",
        message: "A cleaner account with this phone number already exists.",
      };
    }

    if (await cleanerPhoneExists(client, phoneE164)) {
      return {
        ok: false,
        code: "PHONE_ALREADY_REGISTERED",
        message: "A cleaner with this phone number already exists.",
      };
    }

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

    const profileId = created.data.user.id;

    try {
      const { error: profileError } = await client
        .from("profiles")
        .update({ role: "cleaner", full_name: fullName })
        .eq("id", profileId);

      if (profileError) {
        throw new Error(profileError.message);
      }

      const { data: cleanerRow, error: cleanerError } = await client
        .from("cleaners")
        .insert({ profile_id: profileId, phone: phoneE164 })
        .select("id")
        .single();

      if (cleanerError || !cleanerRow) {
        throw new Error(cleanerError?.message ?? "Failed to create cleaner row.");
      }

      const cleanerId = cleanerRow.id;

      try {
        if (values.capabilities.length > 0) {
          const { error: capError } = await client.from("cleaner_service_capabilities").insert(
            values.capabilities.map((service_slug) => ({
              cleaner_id: cleanerId,
              service_slug,
            })),
          );
          if (capError) throw new Error(capError.message);
        }

        if (serviceAreaSlugs.length > 0) {
          const { error: areaError } = await client.from("cleaner_service_areas").insert(
            serviceAreaSlugs.map((area_slug) => ({
              cleaner_id: cleanerId,
              area_slug,
            })),
          );
          if (areaError) throw new Error(areaError.message);
        }

        await replaceCleanerAvailability(client, cleanerId, availabilityWindows);

        const auditId = await recordCleanerProfileAudit(client, {
          cleanerId,
          adminProfileId: params.adminProfileId,
          action: "profile_created",
          outcome: "success",
          reason: null,
          metadata: {
            fullName,
            phoneE164,
            authEmail,
            profileId,
            capabilitySlugs: values.capabilities,
            serviceAreaSlugs,
          },
          idempotencyKey: params.idempotencyKey,
        });

        return {
          ok: true,
          cleanerId,
          auditId,
          message: "Cleaner account created.",
        };
      } catch (childError) {
        await purgeCleanerChildRows(client, cleanerId);
        await client.from("cleaners").delete().eq("id", cleanerId);
        throw childError;
      }
    } catch (provisionError) {
      await deleteAuthUser(client, profileId);
      const message =
        provisionError instanceof Error
          ? provisionError.message
          : "Failed to provision cleaner profile.";
      return { ok: false, code: "PROVISION_FAILED", message };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create cleaner.";
    return { ok: false, code: "PERSISTENCE_ERROR", message };
  }
}
