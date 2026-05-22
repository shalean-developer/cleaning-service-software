import type { ServiceSlug } from "@/features/pricing/server/types";
import { SERVICE_SLUGS } from "@/features/pricing/server/types";
import {
  type CleanerAvailabilityFormField,
  type CleanerAvailabilityFormValues,
  type CleanerAvailabilityWindow,
  validateCleanerAvailabilityForm,
} from "./cleanerAvailability";
import { parseServiceAreasInput } from "./cleanerProfileFormValidation";

export type CleanerEditFormValues = {
  fullName: string;
  serviceAreasInput: string;
  capabilities: ServiceSlug[];
} & CleanerAvailabilityFormValues;

export type CleanerEditFormField =
  | "fullName"
  | "serviceAreasInput"
  | "capabilities"
  | CleanerAvailabilityFormField;

export type CleanerEditFormErrors = Partial<Record<CleanerEditFormField, string>>;

export type CleanerEditFormValidationResult = {
  valid: boolean;
  errors: CleanerEditFormErrors;
  serviceAreaSlugs: string[];
  availabilityWindows: CleanerAvailabilityWindow[];
};

const FULL_NAME_MIN = 2;
const FULL_NAME_MAX = 120;
const MAX_SERVICE_AREAS = 50;

const VALID_CAPABILITY_SLUGS = new Set<string>(SERVICE_SLUGS);

import { findLocationBySlug } from "@/features/locations/locationRegistry";

export function formatServiceAreaSlugsForInput(slugs: string[]): string {
  return slugs.map((slug) => findLocationBySlug(slug)?.name ?? slug).join("\n");
}

export function validateCleanerEditForm(
  values: CleanerEditFormValues,
): CleanerEditFormValidationResult {
  const errors: CleanerEditFormErrors = {};
  const fullName = values.fullName.trim();

  if (!fullName) {
    errors.fullName = "Full name is required.";
  } else if (fullName.length < FULL_NAME_MIN) {
    errors.fullName = `Full name must be at least ${FULL_NAME_MIN} characters.`;
  } else if (fullName.length > FULL_NAME_MAX) {
    errors.fullName = `Full name must be at most ${FULL_NAME_MAX} characters.`;
  }

  const serviceAreaSlugs = parseServiceAreasInput(values.serviceAreasInput);
  if (serviceAreaSlugs.length > MAX_SERVICE_AREAS) {
    errors.serviceAreasInput = `At most ${MAX_SERVICE_AREAS} service areas allowed.`;
  }

  for (const slug of values.capabilities) {
    if (!VALID_CAPABILITY_SLUGS.has(slug)) {
      errors.capabilities = "One or more selected services are invalid.";
      break;
    }
  }

  if (values.capabilities.length === 0) {
    errors.capabilities = "Select at least one service capability.";
  }

  const availability = validateCleanerAvailabilityForm({
    workingDays: values.workingDays,
    startTime: values.startTime,
    endTime: values.endTime,
    timezone: values.timezone,
  });

  const mergedErrors: CleanerEditFormErrors = { ...errors, ...availability.errors };

  return {
    valid: Object.keys(mergedErrors).length === 0,
    errors: mergedErrors,
    serviceAreaSlugs,
    availabilityWindows: availability.windows,
  };
}
