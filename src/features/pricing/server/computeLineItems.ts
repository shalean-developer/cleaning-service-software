import {
  ADDON_CATALOG,
  CLEANING_EQUIPMENT_FEE_CENTS,
  CLEANING_INTENSITY_MULTIPLIERS,
  FREQUENCY_MULTIPLIERS,
  SERVICE_CATALOG,
  TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS,
} from "./catalog";
import { requestedTeamSizeForPricingInput } from "./resolveRequestedTeamSize";
import type {
  AddonSlug,
  CleaningIntensity,
  PricingFrequency,
  PricingInput,
  PricingLineItem,
} from "./types";

function residentialExtras(
  bedrooms: number,
  bathrooms: number,
  extraBedroomCents: number,
  extraBathroomCents: number,
): { bedroomCents: number; bathroomCents: number } {
  const extraBedrooms = Math.max(0, bedrooms - 1);
  const extraBathrooms = Math.max(0, bathrooms - 1);
  return {
    bedroomCents: extraBedrooms * extraBedroomCents,
    bathroomCents: extraBathrooms * extraBathroomCents,
  };
}

export function buildServiceLineItems(input: PricingInput): PricingLineItem[] {
  const rule = SERVICE_CATALOG[input.serviceSlug];
  const items: PricingLineItem[] = [];

  if (rule.perBedroomCents != null) {
    items.push({
      code: "service_base",
      label: rule.label,
      amountCents: rule.baseCents,
    });
    if (input.bedrooms > 0) {
      const zoneCents = input.bedrooms * rule.perBedroomCents;
      items.push({
        code: "carpet_zones",
        label: "Carpet zones",
        quantity: input.bedrooms,
        unitAmountCents: rule.perBedroomCents,
        amountCents: zoneCents,
      });
    }
    return items;
  }

  items.push({
    code: "service_base",
    label: rule.label,
    amountCents: rule.baseCents,
  });

  if (!rule.allowZeroRooms) {
    const { bedroomCents, bathroomCents } = residentialExtras(
      input.bedrooms,
      input.bathrooms,
      rule.extraBedroomCents,
      rule.extraBathroomCents,
    );

    if (bedroomCents > 0) {
      const qty = Math.max(0, input.bedrooms - 1);
      items.push({
        code: "extra_bedrooms",
        label: "Additional bedrooms",
        quantity: qty,
        unitAmountCents: rule.extraBedroomCents,
        amountCents: bedroomCents,
      });
    }

    if (bathroomCents > 0) {
      const qty = Math.max(0, input.bathrooms - 1);
      items.push({
        code: "extra_bathrooms",
        label: "Additional bathrooms",
        quantity: qty,
        unitAmountCents: rule.extraBathroomCents,
        amountCents: bathroomCents,
      });
    }

    const extraRooms = input.extraRooms ?? 0;
    if (extraRooms > 0 && rule.extraRoomCents != null) {
      items.push({
        code: "extra_rooms",
        label: "Extra rooms",
        quantity: extraRooms,
        unitAmountCents: rule.extraRoomCents,
        amountCents: extraRooms * rule.extraRoomCents,
      });
    }
  }

  if (
    rule.propertySizePerSqmCents != null &&
    input.propertySizeSqm != null &&
    input.propertySizeSqm > 0
  ) {
    const free = rule.propertySizeFreeSqm ?? 0;
    const billableSqm = Math.max(0, input.propertySizeSqm - free);
    if (billableSqm > 0) {
      const amountCents = billableSqm * rule.propertySizePerSqmCents;
      items.push({
        code: "property_size",
        label: "Property size",
        quantity: billableSqm,
        unitAmountCents: rule.propertySizePerSqmCents,
        amountCents,
      });
    }
  }

  return items;
}

export function buildAddonLineItems(addons: AddonSlug[] | undefined): PricingLineItem[] {
  const unique = [...new Set(addons ?? [])];
  return unique.map((slug) => {
    const addon = ADDON_CATALOG[slug];
    return {
      code: `addon_${slug}`,
      label: addon.label,
      quantity: 1,
      unitAmountCents: addon.amountCents,
      amountCents: addon.amountCents,
    };
  });
}

const INTENSITY_LINE_LABELS: Record<Exclude<CleaningIntensity, "standard">, string> = {
  detailed: "Detailed cleaning intensity (+15%)",
  heavy: "Heavy cleaning intensity (+30%)",
};

export function buildTeamSupportRequestLineItem(input: PricingInput): PricingLineItem | null {
  if (input.serviceSlug !== "regular-cleaning") return null;
  if (requestedTeamSizeForPricingInput(input) !== 2) return null;

  return {
    code: "team_support_request",
    label: "Team support request",
    quantity: 1,
    unitAmountCents: TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS,
    amountCents: TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS,
  };
}

export function buildEquipmentLineItem(input: PricingInput): PricingLineItem | null {
  if (input.serviceSlug !== "regular-cleaning") return null;
  if ((input.equipmentSupply ?? "customer") !== "shalean") return null;

  return {
    code: "cleaning_equipment",
    label: "Cleaning equipment",
    quantity: 1,
    unitAmountCents: CLEANING_EQUIPMENT_FEE_CENTS,
    amountCents: CLEANING_EQUIPMENT_FEE_CENTS,
  };
}

export function buildIntensityLineItem(
  input: PricingInput,
  preIntensitySubtotalCents: number,
): PricingLineItem | null {
  if (input.serviceSlug !== "regular-cleaning") return null;

  const intensity: CleaningIntensity = input.cleaningIntensity ?? "standard";
  if (intensity === "standard") return null;

  const multiplier = CLEANING_INTENSITY_MULTIPLIERS[intensity];
  const surchargeCents = Math.round(preIntensitySubtotalCents * (multiplier - 1));
  if (surchargeCents <= 0) return null;

  return {
    code: "cleaning_intensity",
    label: INTENSITY_LINE_LABELS[intensity],
    amountCents: surchargeCents,
  };
}

export function buildFrequencyLineItem(
  subtotalCents: number,
  frequency: PricingFrequency,
): PricingLineItem | null {
  const multiplier = FREQUENCY_MULTIPLIERS[frequency];
  if (multiplier >= 1) return null;

  const discountCents = Math.round(subtotalCents * (1 - multiplier));
  if (discountCents <= 0) return null;

  return {
    code: "frequency_discount",
    label: `Recurring discount (${frequency})`,
    amountCents: -discountCents,
  };
}

export function sumLineItems(items: PricingLineItem[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}
