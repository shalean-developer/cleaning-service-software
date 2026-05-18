import {
  formatZaMobileForDisplay,
  normalizeZaMobilePhone,
} from "@/lib/validation/zaPhone";
import type { BookingWizardState } from "./types";

export function resolveWizardContactPhone(
  contactPhone: string,
  profilePhone: string | null,
): string | null {
  return (
    normalizeZaMobilePhone(contactPhone) ?? normalizeZaMobilePhone(profilePhone)
  );
}

export function initialContactPhoneField(
  storedContactPhone: string,
  profilePhone: string | null,
): string {
  if (storedContactPhone.trim()) return storedContactPhone;
  return formatZaMobileForDisplay(profilePhone) ?? "";
}

export function resolveContactPhoneForMetadata(state: BookingWizardState): string | null {
  return resolveWizardContactPhone(state.contactPhone, state.profilePhone);
}
