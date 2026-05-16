import {
  ADDON_CATALOG,
  FREQUENCY_MULTIPLIERS,
  SERVICE_CATALOG,
} from "./catalog";
import type { AddonSlug, PricingFrequency, PricingInput, PricingLineItem } from "./types";

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
