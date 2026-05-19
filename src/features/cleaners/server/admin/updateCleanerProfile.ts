import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { validateCleanerEditForm } from "@/features/cleaners/admin/cleanerProfileEditValidation";
import { parseUpdateCleanerProfileBody } from "./parseUpdateCleanerProfileBody";
import { recordCleanerProfileAudit } from "./recordCleanerProfileAudit";
import type {
  UpdateCleanerProfileParams,
  UpdateCleanerProfileResult,
} from "./updateCleanerProfileTypes";

async function loadCapabilitySlugs(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("cleaner_service_capabilities")
    .select("service_slug")
    .eq("cleaner_id", cleanerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.service_slug as string).sort();
}

async function loadServiceAreaSlugs(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("cleaner_service_areas")
    .select("area_slug")
    .eq("cleaner_id", cleanerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.area_slug as string).sort();
}

async function replaceCapabilities(
  client: SupabaseClient<Database>,
  cleanerId: string,
  slugs: string[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("cleaner_service_capabilities")
    .delete()
    .eq("cleaner_id", cleanerId);
  if (deleteError) throw new Error(deleteError.message);

  if (slugs.length === 0) return;

  const { error: insertError } = await client.from("cleaner_service_capabilities").insert(
    slugs.map((service_slug) => ({
      cleaner_id: cleanerId,
      service_slug,
    })),
  );
  if (insertError) throw new Error(insertError.message);
}

async function replaceServiceAreas(
  client: SupabaseClient<Database>,
  cleanerId: string,
  slugs: string[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("cleaner_service_areas")
    .delete()
    .eq("cleaner_id", cleanerId);
  if (deleteError) throw new Error(deleteError.message);

  if (slugs.length === 0) return;

  const { error: insertError } = await client.from("cleaner_service_areas").insert(
    slugs.map((area_slug) => ({
      cleaner_id: cleanerId,
      area_slug,
    })),
  );
  if (insertError) throw new Error(insertError.message);
}

export async function updateCleanerProfile(
  params: UpdateCleanerProfileParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<UpdateCleanerProfileResult> {
  const parsed = parseUpdateCleanerProfileBody({
    fullName: params.fullName,
    serviceAreasInput: params.serviceAreasInput,
    capabilities: params.capabilities,
    idempotencyKey: params.idempotencyKey,
  });

  if (!parsed.ok) {
    return { ok: false, code: parsed.code, message: parsed.message };
  }

  const { values } = parsed;
  const validation = validateCleanerEditForm(values);
  if (!validation.valid) {
    const firstError =
      validation.errors.fullName ??
      validation.errors.capabilities ??
      validation.errors.serviceAreasInput ??
      "Invalid cleaner profile payload.";
    return { ok: false, code: "INVALID_PAYLOAD", message: firstError };
  }

  const fullName = values.fullName.trim();
  const capabilitySlugs = [...values.capabilities].sort();
  const serviceAreaSlugs = [...validation.serviceAreaSlugs].sort();

  try {
    const { data: cleanerRow, error: cleanerError } = await client
      .from("cleaners")
      .select("id, profile_id")
      .eq("id", params.cleanerId)
      .maybeSingle();

    if (cleanerError) {
      return { ok: false, code: "PERSISTENCE_ERROR", message: cleanerError.message };
    }
    if (!cleanerRow) {
      return { ok: false, code: "CLEANER_NOT_FOUND", message: "Cleaner not found." };
    }

    const { data: profileBefore, error: profileLoadError } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", cleanerRow.profile_id)
      .maybeSingle();

    if (profileLoadError) {
      return { ok: false, code: "PERSISTENCE_ERROR", message: profileLoadError.message };
    }

    const beforeCapabilitySlugs = await loadCapabilitySlugs(client, params.cleanerId);
    const beforeServiceAreaSlugs = await loadServiceAreaSlugs(client, params.cleanerId);
    const beforeFullName = profileBefore?.full_name?.trim() ?? "";

    const { error: profileError } = await client
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", cleanerRow.profile_id);

    if (profileError) {
      return { ok: false, code: "PERSISTENCE_ERROR", message: profileError.message };
    }

    await replaceCapabilities(client, params.cleanerId, capabilitySlugs);
    await replaceServiceAreas(client, params.cleanerId, serviceAreaSlugs);

    const auditId = await recordCleanerProfileAudit(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "profile_updated",
      outcome: "success",
      reason: null,
      metadata: {
        before: {
          fullName: beforeFullName,
          capabilitySlugs: beforeCapabilitySlugs,
          serviceAreaSlugs: beforeServiceAreaSlugs,
        },
        after: {
          fullName,
          capabilitySlugs,
          serviceAreaSlugs,
        },
        profileId: cleanerRow.profile_id,
      },
      idempotencyKey: params.idempotencyKey,
    });

    return {
      ok: true,
      cleanerId: params.cleanerId,
      auditId,
      message: "Cleaner profile updated.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update cleaner profile.";
    return { ok: false, code: "PERSISTENCE_ERROR", message };
  }
}
