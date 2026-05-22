import "server-only";

import { randomBytes } from "node:crypto";
import type { CurrentUser } from "@/lib/auth/types";
import { createCleaner } from "@/features/cleaners/server/admin/createCleaner";
import { defaultCleanerAvailabilityFormValues } from "@/features/cleaners/admin/cleanerAvailability";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getAdminCleanerApplicationDetail } from "./adminCleanerApplicationsReadModel";

function generateProvisioningPassword(): string {
  return randomBytes(18).toString("base64url");
}

function mapServiceInterests(interests: string[]): ServiceSlug[] {
  const valid = new Set([
    "regular-cleaning",
    "deep-cleaning",
    "moving-cleaning",
    "airbnb-cleaning",
    "office-cleaning",
    "carpet-cleaning",
  ]);
  return interests.filter((s): s is ServiceSlug => valid.has(s));
}

export async function convertApplicationToCleaner(
  user: CurrentUser,
  applicationId: string,
): Promise<
  | {
      ok: true;
      cleanerId: string;
      message: string;
      dispatchEligible: false;
    }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const detail = await getAdminCleanerApplicationDetail(user, applicationId);
  if (!detail.ok) {
    return {
      ok: false,
      code: detail.code,
      message: detail.message,
      status: detail.status,
    };
  }

  const app = detail.application;

  if (app.created_cleaner_id) {
    return {
      ok: false,
      code: "ALREADY_CONVERTED",
      message: "This application was already converted to a cleaner account.",
      status: 409,
    };
  }

  const password = generateProvisioningPassword();
  const defaults = defaultCleanerAvailabilityFormValues();
  const capabilities = mapServiceInterests(app.service_interests);
  const serviceAreasInput = app.preferred_areas.join("\n");
  const workingDays =
    app.availability_days.length > 0
      ? app.availability_days
      : [...defaults.workingDays];

  const createResult = await createCleaner({
    adminProfileId: user.profileId,
    fullName: app.full_name,
    phone: app.phone,
    password,
    confirmPassword: password,
    serviceAreasInput,
    capabilities,
    workingDays,
    startTime: defaults.startTime,
    endTime: defaults.endTime,
    timezone: defaults.timezone,
    idempotencyKey: `convert-application-${applicationId}`,
  });

  if (!createResult.ok) {
    return {
      ok: false,
      code: createResult.code,
      message: createResult.message,
      status: createResult.code === "PHONE_ALREADY_REGISTERED" ? 409 : 400,
    };
  }

  const serviceClient = requireServiceRoleClient();
  const { data: cleanerRow } = await serviceClient
    .from("cleaners")
    .select("id, profile_id, active, onboarding_completed_at")
    .eq("id", createResult.cleanerId)
    .single();

  const profileId = cleanerRow?.profile_id ?? null;

  await serviceClient
    .from("cleaner_applications")
    .update({
      status: "approved",
      created_cleaner_id: createResult.cleanerId,
      created_profile_id: profileId,
      reviewed_by: user.profileId,
      reviewed_at: new Date().toISOString(),
      admin_notes: app.admin_notes
        ? `${app.admin_notes}\n[Converted ${new Date().toISOString()}]`
        : `[Converted ${new Date().toISOString()}]`,
      metadata: {
        ...(typeof app.metadata === "object" && app.metadata ? app.metadata : {}),
        conversion: {
          cleanerId: createResult.cleanerId,
          provisioningNote: "Cleaner created inactive; complete onboarding in admin.",
        },
      },
    })
    .eq("id", applicationId);

  return {
    ok: true,
    cleanerId: createResult.cleanerId,
    message:
      "Cleaner account provisioned (inactive, onboarding incomplete). Complete onboarding in admin before dispatch.",
    dispatchEligible: false as const,
  };
}
