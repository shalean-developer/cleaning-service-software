import { buildBookingQuoteMetadata } from "@/features/pricing/server/metadata";
import type { PricingBreakdown, PricingInput } from "@/features/pricing/server/types";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";
import { isAdminAssistedBookingDryRunLabelingEnabled } from "@/lib/app/adminAssistedBookingDryRunFlag";
import type { AdminWizardBillingMetadata } from "./validateAdminWizardBillingMode";

export type AdminBookingDraftAddressInput = {
  addressLine1: string;
  suburb: string;
  city: string;
  locationNotes?: string | null;
  specialInstructions?: string | null;
};

export function buildAdminBookingDraftMetadata(input: {
  adminProfileId: string;
  idempotencyKey: string;
  pricingInput: PricingInput;
  breakdown: PricingBreakdown;
  address: AdminBookingDraftAddressInput;
  cleanerPreferenceMode?: "best_available" | "selected";
  selectedCleanerId?: string | null;
  recurringSchedule?: {
    selectedDays: number[];
    intervalWeeks?: number;
    configuredVia: "admin_wizard_custom" | "admin_wizard_preset";
  } | null;
  billing: AdminWizardBillingMetadata;
}): Record<string, unknown> {
  const quoteMeta = buildBookingQuoteMetadata(input.pricingInput, input.breakdown);
  const suburb = input.address.suburb.trim();
  const city = input.address.city.trim();
  const pilotDryRun = isAdminAssistedBookingDryRunLabelingEnabled();

  return {
    ...quoteMeta,
    adminAssist: {
      createdByProfileId: input.adminProfileId,
      createdAt: new Date().toISOString(),
      source: "admin_wizard",
      idempotencyKey: input.idempotencyKey.trim(),
      phase: "draft_only",
      ...(pilotDryRun
        ? { pilotDryRun: true, pilotDryRunAt: new Date().toISOString() }
        : {}),
    },
    areaSlug: normalizeAreaSlug(suburb),
    suburb,
    city,
    address: {
      line1: input.address.addressLine1.trim(),
      suburb,
      city,
      notes: input.address.locationNotes?.trim() || null,
    },
    specialInstructions: input.address.specialInstructions?.trim() || null,
    cleanerPreferenceMode: input.cleanerPreferenceMode ?? "best_available",
    preferred_cleaner_id:
      input.cleanerPreferenceMode === "selected" ? input.selectedCleanerId ?? null : null,
    timezone: "Africa/Johannesburg",
    ...(input.recurringSchedule
      ? {
          recurringSchedule: {
            selectedDays: input.recurringSchedule.selectedDays,
            ...(input.recurringSchedule.intervalWeeks !== undefined
              ? { intervalWeeks: input.recurringSchedule.intervalWeeks }
              : {}),
            configuredVia: input.recurringSchedule.configuredVia,
          },
        }
      : {}),
    billing: input.billing,
  };
}

export function sanitizeAdminBookingAssistAuditPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const clone = { ...payload };
  if (clone.bookingMetadata && typeof clone.bookingMetadata === "object") {
    const meta = { ...(clone.bookingMetadata as Record<string, unknown>) };
    delete meta.contactPhone;
    clone.bookingMetadata = meta;
  }
  return clone;
}
