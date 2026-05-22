import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { buildApplicationMetadata } from "../applyFormModel";
import {
  cleanerApplicationSubmitSchema,
  type CleanerApplicationSubmitInput,
} from "../schema";
import { buildCleanerIdentityEmail } from "@/features/cleaners/cleanerIdentity";
import {
  normalizeApplicationPhone,
  normalizePreferredAreaSlug,
  phoneNormalizedKey,
} from "../normalize";
import type { CleanerApplicationStatus } from "../types";

export type SubmitCleanerApplicationResult =
  | {
      ok: true;
      status: CleanerApplicationStatus;
      duplicateLikely: boolean;
      message: string;
    }
  | { ok: false; code: string; message: string };

async function findDuplicateSignals(
  client: SupabaseClient<Database>,
  phoneNormalized: string,
  phoneE164: string,
  email: string | null,
): Promise<boolean> {
  const { data: byPhone } = await client
    .from("cleaner_applications")
    .select("id")
    .eq("phone_normalized", phoneNormalized)
    .limit(1);

  if ((byPhone ?? []).length > 0) return true;

  const { data: existingCleaner } = await client
    .from("cleaners")
    .select("id")
    .eq("phone", phoneE164)
    .limit(1);

  if ((existingCleaner ?? []).length > 0) return true;

  if (email) {
    const { data: byEmail } = await client
      .from("cleaner_applications")
      .select("id")
      .ilike("email", email)
      .limit(1);
    if ((byEmail ?? []).length > 0) return true;
  }

  return false;
}

export async function submitCleanerApplication(
  input: CleanerApplicationSubmitInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<SubmitCleanerApplicationResult> {
  const parsed = cleanerApplicationSubmitSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: first?.message ?? "Invalid application payload.",
    };
  }

  const data = parsed.data;

  if (data.website && data.website.length > 0) {
    return { ok: false, code: "SPAM_REJECTED", message: "Submission could not be processed." };
  }

  const phoneE164 = normalizeApplicationPhone(data.phone);
  if (!phoneE164) {
    return {
      ok: false,
      code: "INVALID_PHONE",
      message: "Enter a valid South African mobile number.",
    };
  }

  const email = buildCleanerIdentityEmail(data.phone);
  if (!email) {
    return {
      ok: false,
      code: "INVALID_PHONE",
      message: "Enter a valid South African mobile number.",
    };
  }

  const phoneNormalized = phoneNormalizedKey(phoneE164);
  const duplicateLikely = await findDuplicateSignals(
    client,
    phoneNormalized,
    phoneE164,
    email,
  );
  const status: CleanerApplicationStatus = duplicateLikely ? "duplicate" : "new";

  const preferredAreas = data.preferredAreas.map(normalizePreferredAreaSlug).filter(Boolean);

  const metadata = {
    ...buildApplicationMetadata({
      fullName: data.fullName,
      phone: data.phone,
      suburb: data.suburb,
      city: data.city,
      availabilityDays: data.availabilityDays,
      preferredAreas: data.preferredAreas,
      hasOwnTransport: data.hasOwnTransport,
      workPreferences: data.workPreferences,
      experienceLevel: data.experienceLevel,
      workedInHomes: data.workedInHomes,
      airbnbExperience: data.airbnbExperience,
      skills: data.skills,
      notes: data.notes ?? "",
      references: data.references ?? [],
      consent: true,
      website: "",
    }),
    service_interests_derived: data.serviceInterests,
  };

  const { error } = await client.from("cleaner_applications").insert({
    full_name: data.fullName.trim(),
    email,
    phone: phoneE164,
    phone_normalized: phoneNormalized,
    suburb: data.suburb.trim(),
    city: data.city.trim() || "Cape Town",
    experience_level: data.experienceLevel,
    has_own_transport: data.hasOwnTransport,
    has_cleaning_experience: data.hasCleaningExperience,
    service_interests: data.serviceInterests,
    availability_days: data.availabilityDays,
    preferred_areas: preferredAreas,
    status,
    source: "apply_page",
    notes: data.notes?.trim() || null,
    metadata,
  });

  if (error) {
    return { ok: false, code: "PERSISTENCE_ERROR", message: error.message };
  }

  const message = duplicateLikely
    ? "We may already have your details. Our team will review your application."
    : "Thank you. Your application has been received and will be reviewed by our team.";

  return { ok: true, status, duplicateLikely, message };
}
