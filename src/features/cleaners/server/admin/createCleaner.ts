import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { provisionCleanerIdentity } from "@/lib/auth/provisionCleanerIdentity";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { validateCleanerCreateForm } from "@/features/cleaners/admin/cleanerProfileFormValidation";
import { parseCreateCleanerBody } from "./parseCreateCleanerBody";
import { replaceCleanerAvailability } from "./replaceCleanerAvailability";
import { recordCleanerProfileAudit } from "./recordCleanerProfileAudit";
import type { CreateCleanerParams, CreateCleanerResult } from "./createCleanerTypes";

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

  const identity = await provisionCleanerIdentity(client, {
    authEmail,
    fullName,
    phoneE164,
    password: params.password,
  });

  if (!identity.ok) {
    return { ok: false, code: identity.code, message: identity.message };
  }

  const { profileId, cleanerId, createdAuthUser } = identity;

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
    if (createdAuthUser) {
      const { error: deleteAuthError } = await client.auth.admin.deleteUser(profileId);
      if (deleteAuthError) {
        console.error(
          `[createCleaner] Failed to delete auth user ${profileId} after child row error:`,
          deleteAuthError.message,
        );
      }
    }
    const message =
      childError instanceof Error ? childError.message : "Failed to provision cleaner profile.";
    return { ok: false, code: "PROVISION_FAILED", message };
  }
}
