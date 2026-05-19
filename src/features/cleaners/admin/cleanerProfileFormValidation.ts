import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";
import { isValidZaMobilePhone, normalizeZaMobilePhone } from "@/lib/validation/zaPhone";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { SERVICE_SLUGS } from "@/features/pricing/server/types";
import {
  type CleanerAvailabilityFormField,
  type CleanerAvailabilityFormValues,
  type CleanerAvailabilityWindow,
  validateCleanerAvailabilityForm,
} from "./cleanerAvailability";

export const CLEANER_CREATE_MIN_PASSWORD_LENGTH = 8;

export type CleanerCreateFormValues = {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
  serviceAreasInput: string;
  capabilities: ServiceSlug[];
} & CleanerAvailabilityFormValues;

export type CleanerCreateFormField =
  | "fullName"
  | "phone"
  | "password"
  | "confirmPassword"
  | "serviceAreasInput"
  | "capabilities"
  | CleanerAvailabilityFormField;

export type CleanerCreateFormErrors = Partial<Record<CleanerCreateFormField, string>>;

export type CleanerCreateFormValidationResult = {
  valid: boolean;
  errors: CleanerCreateFormErrors;
  /** Normalized slugs from serviceAreasInput (empty = all areas at assignment time). */
  serviceAreaSlugs: string[];
  /** E.164 phone when valid. */
  phoneE164: string | null;
  /** Generated login email preview (localPhone@shalean.co.za). */
  generatedAuthEmail: string | null;
  availabilityWindows: CleanerAvailabilityWindow[];
};

const FULL_NAME_MIN = 2;
const FULL_NAME_MAX = 120;
const MAX_SERVICE_AREAS = 50;

const VALID_CAPABILITY_SLUGS = new Set<string>(SERVICE_SLUGS);

export function parseServiceAreasInput(raw: string): string[] {
  const parts = raw.split(/[\n,]+/);
  const slugs: string[] = [];
  const seen = new Set<string>();

  for (const part of parts) {
    const slug = normalizeAreaSlug(part);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }

  return slugs;
}

export function validateCleanerCreateForm(
  values: CleanerCreateFormValues,
): CleanerCreateFormValidationResult {
  const errors: CleanerCreateFormErrors = {};
  const fullName = values.fullName.trim();
  const phone = values.phone.trim();
  const password = values.password;
  const confirmPassword = values.confirmPassword;

  if (!fullName) {
    errors.fullName = "Full name is required.";
  } else if (fullName.length < FULL_NAME_MIN) {
    errors.fullName = `Full name must be at least ${FULL_NAME_MIN} characters.`;
  } else if (fullName.length > FULL_NAME_MAX) {
    errors.fullName = `Full name must be at most ${FULL_NAME_MAX} characters.`;
  }

  let phoneE164: string | null = null;
  let generatedAuthEmail: string | null = null;

  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (!isValidZaMobilePhone(phone)) {
    errors.phone = "Enter a valid South African mobile number.";
  } else {
    phoneE164 = normalizeZaMobilePhone(phone);
    generatedAuthEmail = buildShaleanCleanerAuthEmail(phone);
    if (!generatedAuthEmail) {
      errors.phone = "Enter a valid South African mobile number.";
    }
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (password.length < CLEANER_CREATE_MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${CLEANER_CREATE_MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Confirm password is required.";
  } else if (password && confirmPassword !== password) {
    errors.confirmPassword = "Passwords do not match.";
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

  const mergedErrors: CleanerCreateFormErrors = { ...errors, ...availability.errors };

  return {
    valid: Object.keys(mergedErrors).length === 0,
    errors: mergedErrors,
    serviceAreaSlugs,
    phoneE164,
    generatedAuthEmail,
    availabilityWindows: availability.windows,
  };
}

export function isCleanerCreateFormSubmittable(
  values: CleanerCreateFormValues,
): boolean {
  return validateCleanerCreateForm(values).valid;
}
