import { SERVICE_CATALOG, isServiceSlug } from "@/features/pricing/server/catalog";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import {
  resolveAssignmentVisibility,
  type AssignmentVisibilityKey,
} from "@/features/assignments/server/resolveAssignmentVisibility";
import type { Json } from "@/lib/database/types";
import { parseCustomerBookingServiceDetails } from "../customerBookingServiceDetailsDisplay";

export type BookingDisplayFields = {
  serviceSlug: string | null;
  serviceLabel: string;
  suburb: string | null;
  city: string | null;
  addressLine: string | null;
  locationSummary: string;
  homeSizeSummary: string | null;
  frequencyLabel: string | null;
  addonsSummary: string | null;
  cleanerPreferenceMode: string | null;
  preferredCleanerId: string | null;
  specialInstructions: string | null;
  assignmentAttention: string | null;
  assignmentReason: string | null;
  assignmentVisibilityKey: AssignmentVisibilityKey;
  assignmentCustomerMessage: string | null;
  showCustomerAssignmentWarning: boolean;
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readSlugFromRecord(record: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(record.serviceSlug) ??
    readNonEmptyString(record.service_slug) ??
    readNonEmptyString(record.lockedServiceSlug) ??
    readNonEmptyString(record.locked_service_slug)
  );
}

/**
 * Resolves a pricing catalog service slug from booking metadata (wizard, legacy, or snapshots).
 */
export function resolveServiceSlugFromMetadata(
  metadata: Json | null | undefined,
): string | null {
  const record = asRecord(metadata);

  const topLevel = readSlugFromRecord(record);
  if (topLevel) return topLevel;

  const quote = record.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const quoteRecord = quote as Record<string, unknown>;
    const fromQuote = readSlugFromRecord(quoteRecord);
    if (fromQuote) return fromQuote;

    const input = quoteRecord.input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      const fromInput = readSlugFromRecord(input as Record<string, unknown>);
      if (fromInput) return fromInput;
    }
  }

  return null;
}

export function serviceLabelFromSlug(serviceSlug: string | null): string {
  if (serviceSlug && isServiceSlug(serviceSlug)) {
    return SERVICE_CATALOG[serviceSlug].label;
  }
  return "Cleaning service";
}

export function parseBookingDisplay(metadata: Json | null | undefined): BookingDisplayFields {
  const record = asRecord(metadata);
  const serviceSlug = resolveServiceSlugFromMetadata(metadata);
  const serviceLabel = serviceLabelFromSlug(serviceSlug);

  const address =
    record.address != null && typeof record.address === "object" && !Array.isArray(record.address)
      ? (record.address as Record<string, unknown>)
      : null;

  const line1 = typeof address?.line1 === "string" ? address.line1 : null;
  const suburb =
    typeof record.suburb === "string"
      ? record.suburb
      : typeof address?.suburb === "string"
        ? address.suburb
        : null;
  const city =
    typeof record.city === "string"
      ? record.city
      : typeof address?.city === "string"
        ? address.city
        : null;

  const locationParts = [line1, suburb, city].filter(Boolean);
  const locationSummary = locationParts.length > 0 ? locationParts.join(", ") : "—";

  const assignment = readAssignmentMetadata(metadata);
  const serviceDetails = parseCustomerBookingServiceDetails(metadata, serviceSlug);

  return {
    serviceSlug,
    serviceLabel,
    suburb,
    city,
    addressLine: line1,
    locationSummary,
    homeSizeSummary: serviceDetails.homeSizeSummary,
    frequencyLabel: serviceDetails.frequencyLabel,
    addonsSummary: serviceDetails.addonsSummary,
    cleanerPreferenceMode:
      typeof record.cleanerPreferenceMode === "string" ? record.cleanerPreferenceMode : null,
    preferredCleanerId:
      typeof record.preferred_cleaner_id === "string" ? record.preferred_cleaner_id : null,
    specialInstructions:
      typeof record.specialInstructions === "string" ? record.specialInstructions : null,
    assignmentAttention: assignment?.status ?? null,
    assignmentReason: assignment?.reason ?? null,
    assignmentVisibilityKey: null,
    assignmentCustomerMessage: null,
    showCustomerAssignmentWarning: false,
  };
}

export function enrichBookingDisplayWithAssignmentVisibility(
  display: BookingDisplayFields,
  input: {
    bookingStatus: import("@/features/bookings/server/types").BookingStatus;
    metadata: Json | null | undefined;
    hasOpenOffer: boolean;
    offerStatuses: readonly import("@/lib/database/types").AssignmentOfferStatus[];
    dispatchNotStarted?: boolean;
  },
): BookingDisplayFields {
  const visibility = resolveAssignmentVisibility({
    bookingStatus: input.bookingStatus,
    metadata: input.metadata,
    hasOpenOffer: input.hasOpenOffer,
    offerStatuses: input.offerStatuses,
    dispatchNotStarted: input.dispatchNotStarted,
  });

  return {
    ...display,
    assignmentVisibilityKey: visibility.key,
    assignmentCustomerMessage: visibility.customerMessage,
    showCustomerAssignmentWarning: visibility.showCustomerAssignmentWarning,
    assignmentAttention: readAssignmentMetadata(input.metadata)?.status ?? display.assignmentAttention,
    assignmentReason: readAssignmentMetadata(input.metadata)?.reason ?? display.assignmentReason,
  };
}

export function formatScheduleRange(
  scheduledStart: string,
  scheduledEnd: string,
  timezone = "Africa/Johannesburg",
): string {
  try {
    const start = new Date(scheduledStart);
    const end = new Date(scheduledEnd);
    const dateFmt = new Intl.DateTimeFormat("en-ZA", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeFmt = new Intl.DateTimeFormat("en-ZA", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
  } catch {
    return `${scheduledStart} – ${scheduledEnd}`;
  }
}

export function formatZar(cents: number, currency = "ZAR"): string {
  if (currency !== "ZAR") {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
