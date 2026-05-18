import {
  isAddonSlug,
  isCleaningIntensity,
  isEquipmentSupply,
  isPricingFrequency,
  isServiceSlug,
} from "./catalog";
import type { PricingInput } from "./types";

export function parsePricingInputFromJson(
  body: Record<string, unknown>,
): PricingInput | { error: string } {
  const serviceSlugRaw =
    typeof body.serviceSlug === "string"
      ? body.serviceSlug
      : typeof body.service_slug === "string"
        ? body.service_slug
        : null;

  if (!serviceSlugRaw || !isServiceSlug(serviceSlugRaw)) {
    return { error: "serviceSlug is required and must be a known service." };
  }

  const bedrooms = body.bedrooms;
  const bathrooms = body.bathrooms;

  if (typeof bedrooms !== "number" || typeof bathrooms !== "number") {
    return { error: "bedrooms and bathrooms are required numbers." };
  }

  const extraRooms =
    typeof body.extraRooms === "number"
      ? body.extraRooms
      : typeof body.extra_rooms === "number"
        ? body.extra_rooms
        : undefined;

  const cleaningIntensityRaw =
    typeof body.cleaningIntensity === "string"
      ? body.cleaningIntensity
      : typeof body.cleaning_intensity === "string"
        ? body.cleaning_intensity
        : undefined;
  const cleaningIntensity =
    cleaningIntensityRaw == null
      ? undefined
      : isCleaningIntensity(cleaningIntensityRaw)
        ? cleaningIntensityRaw
        : undefined;

  if (cleaningIntensityRaw != null && cleaningIntensity === undefined) {
    return { error: "cleaningIntensity is invalid." };
  }

  const equipmentSupplyRaw =
    typeof body.equipmentSupply === "string"
      ? body.equipmentSupply
      : typeof body.equipment_supply === "string"
        ? body.equipment_supply
        : undefined;
  const equipmentSupply =
    equipmentSupplyRaw == null
      ? undefined
      : isEquipmentSupply(equipmentSupplyRaw)
        ? equipmentSupplyRaw
        : undefined;

  if (equipmentSupplyRaw != null && equipmentSupply === undefined) {
    return { error: "equipmentSupply is invalid." };
  }

  const frequencyRaw =
    typeof body.frequency === "string" ? body.frequency : undefined;
  const frequency =
    frequencyRaw == null
      ? undefined
      : isPricingFrequency(frequencyRaw)
        ? frequencyRaw
        : undefined;

  if (frequencyRaw != null && frequency === undefined) {
    return { error: "frequency is invalid." };
  }

  const addonsRaw = body.addons;
  const addons: PricingInput["addons"] = [];
  if (addonsRaw != null) {
    if (!Array.isArray(addonsRaw)) {
      return { error: "addons must be an array of strings." };
    }
    for (const item of addonsRaw) {
      if (typeof item !== "string" || !isAddonSlug(item)) {
        return { error: `Invalid add-on: ${String(item)}` };
      }
      addons.push(item);
    }
  }

  const teamSize =
    typeof body.teamSize === "number"
      ? body.teamSize
      : typeof body.team_size === "number"
        ? body.team_size
        : undefined;

  const requestedTeamSize =
    typeof body.requestedTeamSize === "number"
      ? body.requestedTeamSize
      : typeof body.requested_team_size === "number"
        ? body.requested_team_size
        : undefined;

  const propertySizeSqm =
    typeof body.propertySizeSqm === "number"
      ? body.propertySizeSqm
      : typeof body.property_size_sqm === "number"
        ? body.property_size_sqm
        : body.propertySizeSqm === null
          ? null
          : undefined;

  const cleanerTenureMonths =
    typeof body.cleanerTenureMonths === "number"
      ? body.cleanerTenureMonths
      : typeof body.cleaner_tenure_months === "number"
        ? body.cleaner_tenure_months
        : body.cleanerTenureMonths === null
          ? null
          : undefined;

  return {
    serviceSlug: serviceSlugRaw,
    bedrooms,
    bathrooms,
    extraRooms,
    cleaningIntensity,
    equipmentSupply,
    propertySizeSqm,
    frequency,
    addons: addons.length > 0 ? addons : undefined,
    teamSize,
    requestedTeamSize,
    cleanerTenureMonths,
  };
}
