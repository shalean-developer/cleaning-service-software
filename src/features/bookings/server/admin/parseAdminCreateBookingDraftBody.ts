import { z } from "zod";
import {
  ADDON_SLUGS,
  CLEANING_INTENSITIES,
  EQUIPMENT_SUPPLY_OPTIONS,
  PRICING_FREQUENCIES,
  SERVICE_SLUGS,
} from "@/features/pricing/server/types";

const pricingInputSchema = z.object({
  serviceSlug: z.enum(SERVICE_SLUGS),
  bedrooms: z.number().int().min(0).max(20),
  bathrooms: z.number().int().min(0).max(20),
  extraRooms: z.number().int().min(0).max(20).optional(),
  cleaningIntensity: z.enum(CLEANING_INTENSITIES).optional(),
  equipmentSupply: z.enum(EQUIPMENT_SUPPLY_OPTIONS).optional(),
  propertySizeSqm: z.number().int().min(1).max(50_000).nullable().optional(),
  frequency: z.enum(PRICING_FREQUENCIES),
  addons: z.array(z.enum(ADDON_SLUGS)).optional(),
  requestedTeamSize: z.number().int().min(1).max(4).optional(),
});

const addressSchema = z.object({
  addressLine1: z.string().trim().min(1, "Address line is required."),
  suburb: z.string().trim().min(1, "Suburb is required."),
  city: z.string().trim().min(1, "City is required."),
  locationNotes: z.string().trim().max(2000).nullable().optional(),
  specialInstructions: z.string().trim().max(4000).nullable().optional(),
});

export const adminCreateBookingDraftBodySchema = z.object({
  customerId: z.string().uuid("customerId must be a valid UUID."),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "idempotencyKey must be at least 8 characters.")
    .max(200),
  scheduledStart: z.string().datetime({ offset: true, message: "scheduledStart must be ISO-8601." }),
  scheduledEnd: z.string().datetime({ offset: true, message: "scheduledEnd must be ISO-8601." }),
  pricingInput: pricingInputSchema,
  address: addressSchema,
  cleanerPreferenceMode: z.enum(["best_available", "selected"]).optional(),
  selectedCleanerId: z.string().uuid().nullable().optional(),
  serviceId: z.string().uuid().nullable().optional(),
});

export type AdminCreateBookingDraftBody = z.infer<typeof adminCreateBookingDraftBodySchema>;

export type ParseAdminCreateBookingDraftBodyResult =
  | { ok: true; values: AdminCreateBookingDraftBody }
  | { ok: false; code: "INVALID_PAYLOAD"; message: string };

export function parseAdminCreateBookingDraftBody(
  body: unknown,
): ParseAdminCreateBookingDraftBodyResult {
  const parsed = adminCreateBookingDraftBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }

  const startMs = new Date(parsed.data.scheduledStart).getTime();
  const endMs = new Date(parsed.data.scheduledEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "scheduledEnd must be after scheduledStart.",
    };
  }

  if (
    parsed.data.cleanerPreferenceMode === "selected" &&
    !parsed.data.selectedCleanerId?.trim()
  ) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "selectedCleanerId is required when cleanerPreferenceMode is selected.",
    };
  }

  return { ok: true, values: parsed.data };
}
