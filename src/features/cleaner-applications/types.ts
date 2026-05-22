export const CLEANER_APPLICATION_STATUSES = [
  "new",
  "reviewing",
  "approved",
  "rejected",
  "duplicate",
] as const;

export type CleanerApplicationStatus = (typeof CLEANER_APPLICATION_STATUSES)[number];

export type CleanerApplicationRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  phone_normalized: string;
  suburb: string | null;
  city: string;
  experience_level: string | null;
  has_own_transport: boolean | null;
  has_cleaning_experience: boolean | null;
  service_interests: string[];
  availability_days: number[];
  preferred_areas: string[];
  status: CleanerApplicationStatus;
  source: string;
  notes: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_profile_id: string | null;
  created_cleaner_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const CLEANER_APPLY_EXPERIENCE_LEVELS = [
  "less_than_1_year",
  "1_3_years",
  "3_plus_years",
] as const;

export type CleanerApplyExperienceLevel = (typeof CLEANER_APPLY_EXPERIENCE_LEVELS)[number];
