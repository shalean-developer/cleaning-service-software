import { z } from "zod";
import { buildCleanerIdentityEmail } from "@/features/cleaners/cleanerIdentity";
import {
  CLEANER_APPLY_SKILL_KEYS,
  CLEANER_APPLY_WORK_PREFERENCES,
  workPreferencesToServiceSlugs,
} from "./applyFormModel";
import { CLEANER_APPLY_EXPERIENCE_LEVELS } from "./types";

const workPreferenceSchema = z.enum(CLEANER_APPLY_WORK_PREFERENCES);

const skillsSchema = z.object({
  laundry: z.boolean().optional().default(false),
  ironing: z.boolean().optional().default(false),
  officeCleaning: z.boolean().optional().default(false),
  petsOkay: z.boolean().optional().default(false),
  familyHomesOkay: z.boolean().optional().default(false),
});

const referenceSchema = z.object({
  name: z.string().trim().max(120),
  phone: z.string().trim().max(32),
});

export const cleanerApplicationSubmitSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required.").max(120),
    phone: z.string().trim().min(8, "Phone number is required.").max(32),
    suburb: z.string().trim().min(1, "Suburb is required.").max(120),
    city: z.string().trim().min(1).max(80).default("Cape Town"),
    availabilityDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Select at least one available day."),
    preferredAreas: z
      .array(z.string().trim().min(1).max(80))
      .min(1, "Select at least one preferred area."),
    hasOwnTransport: z.boolean(),
    workPreferences: z
      .array(workPreferenceSchema)
      .min(1, "Select at least one work preference."),
    experienceLevel: z.enum(CLEANER_APPLY_EXPERIENCE_LEVELS),
    workedInHomes: z.boolean(),
    airbnbExperience: z.boolean(),
    skills: skillsSchema,
    notes: z.string().trim().max(2000).optional(),
    references: z.array(referenceSchema).max(2).optional().default([]),
    consent: z.literal(true, {
      message:
        "You must agree that Shalean may contact you regarding opportunities and onboarding.",
    }),
    website: z.string().max(0).optional(),
  })
  .superRefine((data, ctx) => {
    const generatedEmail = buildCleanerIdentityEmail(data.phone);
    if (!generatedEmail) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid South African mobile number.",
        path: ["phone"],
      });
    }
  })
  .transform((data) => {
    const generatedEmail = buildCleanerIdentityEmail(data.phone)!;
    return {
      ...data,
      email: generatedEmail,
      serviceInterests: workPreferencesToServiceSlugs(data.workPreferences),
      hasCleaningExperience:
        data.workedInHomes ||
        data.airbnbExperience ||
        data.experienceLevel !== "less_than_1_year",
    };
  });

export type CleanerApplicationSubmitInput = z.input<typeof cleanerApplicationSubmitSchema>;
export type CleanerApplicationSubmitParsed = z.output<typeof cleanerApplicationSubmitSchema>;

export const cleanerApplicationStatusUpdateSchema = z.object({
  status: z.enum(["new", "reviewing", "approved", "rejected", "duplicate"]),
  adminNotes: z.string().trim().max(4000).optional(),
});

/** Ensures skill keys from client match expected shape. */
export function normalizeSkillsInput(
  input: Partial<Record<(typeof CLEANER_APPLY_SKILL_KEYS)[number], boolean>> | undefined,
): z.infer<typeof skillsSchema> {
  const base = {
    laundry: false,
    ironing: false,
    officeCleaning: false,
    petsOkay: false,
    familyHomesOkay: false,
  };
  if (!input) return base;
  for (const key of CLEANER_APPLY_SKILL_KEYS) {
    if (typeof input[key] === "boolean") base[key] = input[key];
  }
  return base;
}
