import type { ServiceSlug } from "@/features/pricing/server/types";
import { CLEANER_APPLY_EXPERIENCE_LEVELS } from "./types";

export const CLEANER_APPLY_WORK_PREFERENCES = [
  "regular_home_cleaning",
  "deep_cleaning",
  "airbnb_turnovers",
  "office_cleaning",
  "recurring_schedules",
] as const;

export type CleanerApplyWorkPreference = (typeof CLEANER_APPLY_WORK_PREFERENCES)[number];

export const CLEANER_APPLY_WORK_PREFERENCE_LABELS: Record<CleanerApplyWorkPreference, string> = {
  regular_home_cleaning: "Regular home cleaning",
  deep_cleaning: "Deep cleaning",
  airbnb_turnovers: "Airbnb turnovers",
  office_cleaning: "Office cleaning",
  recurring_schedules: "Recurring schedules",
};

export const CLEANER_APPLY_SKILL_KEYS = [
  "laundry",
  "ironing",
  "officeCleaning",
  "petsOkay",
  "familyHomesOkay",
] as const;

export type CleanerApplySkillKey = (typeof CLEANER_APPLY_SKILL_KEYS)[number];

export const CLEANER_APPLY_SKILL_LABELS: Record<CleanerApplySkillKey, string> = {
  laundry: "Laundry",
  ironing: "Ironing",
  officeCleaning: "Office cleaning experience",
  petsOkay: "Comfortable around pets",
  familyHomesOkay: "Comfortable in family homes",
};

export type CleanerApplyReference = {
  name: string;
  phone: string;
};

export type CleanerApplyFormState = {
  fullName: string;
  phone: string;
  suburb: string;
  city: string;
  availabilityDays: number[];
  preferredAreas: string[];
  hasOwnTransport: boolean | null;
  workPreferences: CleanerApplyWorkPreference[];
  experienceLevel: (typeof CLEANER_APPLY_EXPERIENCE_LEVELS)[number] | "";
  workedInHomes: boolean | null;
  airbnbExperience: boolean | null;
  skills: Record<CleanerApplySkillKey, boolean>;
  notes: string;
  references: CleanerApplyReference[];
  consent: boolean;
  website: string;
};

export const CLEANER_APPLY_FORM_STEPS = [
  { id: "personal", label: "Personal details" },
  { id: "availability", label: "Availability & work" },
  { id: "experience", label: "Experience & skills" },
  { id: "review", label: "Review & submit" },
] as const;

export type CleanerApplyStepId = (typeof CLEANER_APPLY_FORM_STEPS)[number]["id"];

export const INITIAL_CLEANER_APPLY_FORM: CleanerApplyFormState = {
  fullName: "",
  phone: "",
  suburb: "",
  city: "Cape Town",
  availabilityDays: [],
  preferredAreas: [],
  hasOwnTransport: null,
  workPreferences: [],
  experienceLevel: "",
  workedInHomes: null,
  airbnbExperience: null,
  skills: {
    laundry: false,
    ironing: false,
    officeCleaning: false,
    petsOkay: false,
    familyHomesOkay: false,
  },
  notes: "",
  references: [{ name: "", phone: "" }],
  consent: false,
  website: "",
};

export type CleanerApplyFieldErrors = Partial<
  Record<keyof CleanerApplyFormState | "submit" | "reference", string>
>;

export function workPreferencesToServiceSlugs(
  preferences: readonly CleanerApplyWorkPreference[],
): ServiceSlug[] {
  const slugs = new Set<ServiceSlug>();
  for (const pref of preferences) {
    switch (pref) {
      case "regular_home_cleaning":
      case "recurring_schedules":
        slugs.add("regular-cleaning");
        break;
      case "deep_cleaning":
        slugs.add("deep-cleaning");
        break;
      case "airbnb_turnovers":
        slugs.add("airbnb-cleaning");
        break;
      case "office_cleaning":
        slugs.add("office-cleaning");
        break;
      default:
        break;
    }
  }
  return [...slugs];
}

export function validateCleanerApplyStep(
  stepIndex: number,
  values: CleanerApplyFormState,
): CleanerApplyFieldErrors {
  const errors: CleanerApplyFieldErrors = {};

  if (stepIndex === 0) {
    if (!values.fullName.trim()) errors.fullName = "Full name is required.";
    if (!values.phone.trim()) errors.phone = "Phone number is required.";
    if (!values.suburb.trim()) errors.suburb = "Suburb is required.";
    if (!values.city.trim()) errors.city = "City is required.";
  }

  if (stepIndex === 1) {
    if (values.availabilityDays.length === 0) {
      errors.availabilityDays = "Select at least one available day.";
    }
    if (values.preferredAreas.length === 0) {
      errors.preferredAreas = "Select at least one preferred area.";
    }
    if (values.hasOwnTransport === null) {
      errors.hasOwnTransport = "Please indicate if you have your own transport.";
    }
    if (values.workPreferences.length === 0) {
      errors.workPreferences = "Select at least one type of work.";
    }
  }

  if (stepIndex === 2) {
    if (!values.experienceLevel) {
      errors.experienceLevel = "Select your years of cleaning experience.";
    }
    if (values.workedInHomes === null) {
      errors.workedInHomes = "Please tell us if you have worked in homes before.";
    }
    if (values.airbnbExperience === null) {
      errors.airbnbExperience = "Please tell us about Airbnb cleaning experience.";
    }
    const filledRefs = values.references.filter(
      (r) => r.name.trim() || r.phone.trim(),
    );
    for (const ref of filledRefs) {
      if (ref.name.trim() && !ref.phone.trim()) {
        errors.reference = "Add a phone number for each reference, or leave blank.";
        break;
      }
      if (!ref.name.trim() && ref.phone.trim()) {
        errors.reference = "Add a name for each reference, or leave blank.";
        break;
      }
    }
  }

  if (stepIndex === 3) {
    if (!values.consent) {
      errors.consent =
        "You must agree that Shalean may contact you regarding opportunities and onboarding.";
    }
  }

  return errors;
}

export function buildApplicationMetadata(values: CleanerApplyFormState) {
  const references = values.references
    .filter((r) => r.name.trim() && r.phone.trim())
    .map((r) => ({ name: r.name.trim(), phone: r.phone.trim() }));

  return {
    submitted_via: "public_apply_v2",
    work_preferences: values.workPreferences,
    skills: values.skills,
    worked_in_homes: values.workedInHomes,
    airbnb_experience: values.airbnbExperience,
    references,
    draft_version: 2,
  };
}

export function hasCleaningExperienceFromForm(values: CleanerApplyFormState): boolean {
  return (
    values.workedInHomes === true ||
    values.airbnbExperience === true ||
    (values.experienceLevel !== "" && values.experienceLevel !== "less_than_1_year")
  );
}
