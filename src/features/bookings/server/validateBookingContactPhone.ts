import { normalizeZaMobilePhone } from "@/lib/validation/zaPhone";

export function readContactPhoneFromMetadata(
  metadata: Record<string, unknown>,
): string | null {
  const raw =
    typeof metadata.contactPhone === "string"
      ? metadata.contactPhone
      : typeof metadata.customerPhone === "string"
        ? metadata.customerPhone
        : null;
  return normalizeZaMobilePhone(raw);
}

export function validateBookingContactPhoneMetadata(
  metadata: Record<string, unknown>,
): { ok: true; contactPhone: string } | { ok: false; message: string } {
  const contactPhone = readContactPhoneFromMetadata(metadata);
  if (!contactPhone) {
    return {
      ok: false,
      message:
        "A valid South African mobile contact number is required before checkout.",
    };
  }
  return { ok: true, contactPhone };
}
