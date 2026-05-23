import type { AdminBookingWizardFormState } from "./draftFormState";

export function composeAdminLocationNotes(
  form: Pick<
    AdminBookingWizardFormState,
    "locationNotes" | "accessInstructions" | "gateCode" | "parkingInstructions"
  >,
): string {
  const parts: string[] = [];
  if (form.accessInstructions.trim()) {
    parts.push(`Access: ${form.accessInstructions.trim()}`);
  }
  if (form.gateCode.trim()) {
    parts.push(`Gate/intercom: ${form.gateCode.trim()}`);
  }
  if (form.parkingInstructions.trim()) {
    parts.push(`Parking: ${form.parkingInstructions.trim()}`);
  }
  if (form.locationNotes.trim()) {
    parts.push(form.locationNotes.trim());
  }
  return parts.join("\n");
}

export function composeAdminSpecialInstructions(
  form: Pick<AdminBookingWizardFormState, "specialInstructions" | "petNotes">,
): string {
  const parts: string[] = [];
  if (form.petNotes.trim()) {
    parts.push(`Pets: ${form.petNotes.trim()}`);
  }
  if (form.specialInstructions.trim()) {
    parts.push(form.specialInstructions.trim());
  }
  return parts.join("\n");
}

export function buildAdminDraftAddressPayload(
  form: AdminBookingWizardFormState,
): {
  addressLine1: string;
  suburb: string;
  city: string;
  locationNotes: string | null;
  specialInstructions: string | null;
} {
  const locationNotes = composeAdminLocationNotes(form);
  const specialInstructions = composeAdminSpecialInstructions(form);

  return {
    addressLine1: form.addressLine1.trim(),
    suburb: form.suburb.trim(),
    city: form.city.trim(),
    locationNotes: locationNotes || null,
    specialInstructions: specialInstructions || null,
  };
}
