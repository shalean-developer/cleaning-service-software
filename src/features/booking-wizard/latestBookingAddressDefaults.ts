import type { Json } from "@/lib/database/types";
import type { BookingWizardState } from "./types";

export type LatestBookingAddressDefaults = {
  addressLine1?: string;
  suburb?: string;
  city?: string;
  locationNotes?: string;
};

function asRecord(metadata: unknown): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readNonEmptyTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Reads address fields from a booking metadata snapshot for wizard prefill.
 * Returns only non-empty fields; omits keys with no usable value.
 */
export function extractLatestBookingAddressDefaults(
  metadata: Json | unknown,
): LatestBookingAddressDefaults {
  const record = asRecord(metadata);
  const address =
    record.address != null && typeof record.address === "object" && !Array.isArray(record.address)
      ? (record.address as Record<string, unknown>)
      : null;

  const out: LatestBookingAddressDefaults = {};

  const line1 = readNonEmptyTrimmed(address?.line1);
  if (line1) out.addressLine1 = line1;

  const suburb =
    readNonEmptyTrimmed(record.suburb) ?? readNonEmptyTrimmed(address?.suburb);
  if (suburb) out.suburb = suburb;

  const city = readNonEmptyTrimmed(record.city) ?? readNonEmptyTrimmed(address?.city);
  if (city) out.city = city;

  const notes = readNonEmptyTrimmed(address?.notes);
  if (notes) out.locationNotes = notes;

  return out;
}

export type StoredAddressFields = {
  addressLine1: string;
  suburb: string;
  city: string;
  locationNotes: string;
};

/** Applies latest-booking defaults only for fields empty in persisted wizard state. */
export function initialAddressFields(
  stored: StoredAddressFields,
  defaults: LatestBookingAddressDefaults | null | undefined,
): StoredAddressFields {
  const latest = defaults ?? {};

  return {
    addressLine1: stored.addressLine1.trim()
      ? stored.addressLine1
      : (latest.addressLine1 ?? ""),
    suburb: stored.suburb.trim() ? stored.suburb : (latest.suburb ?? ""),
    city: stored.city.trim() ? stored.city : (latest.city ?? ""),
    locationNotes: stored.locationNotes.trim()
      ? stored.locationNotes
      : (latest.locationNotes ?? ""),
  };
}

/** Merges address defaults into loaded wizard state without replacing unrelated fields. */
export function mergeLoadedWizardAddressDefaults(
  loaded: BookingWizardState,
  defaults: LatestBookingAddressDefaults | null | undefined,
): BookingWizardState {
  const hasDefaults =
    defaults != null && Object.keys(defaults).length > 0;
  return {
    ...loaded,
    ...initialAddressFields(loaded, hasDefaults ? defaults : null),
  };
}
