"use client";

import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug, ServiceSlug } from "@/features/pricing/server/types";
import { getAddonStepDisplayOrder, getAddonStepLabel } from "../addonStepDisplay";
import { ADDON_STEP_DESCRIPTIONS } from "../constants";
import { DETAILS_STEP_SECTION } from "../detailsStepUi";
import { formatAddonPrice } from "../format";
import { DetailsSectionHeading } from "./DetailsSectionHeading";
import { DetailsToggleSwitch } from "./DetailsToggleSwitch";

type Props = {
  serviceSlug: ServiceSlug | null;
  selected: AddonSlug[];
  onChange: (addons: AddonSlug[]) => void;
};

type AddonRowProps = {
  slug: AddonSlug;
  label: string;
  checked: boolean;
  onToggle: (slug: AddonSlug, enabled: boolean) => void;
};

function AddonRow({ slug, label, checked, onToggle }: AddonRowProps) {
  const addon = ADDON_CATALOG[slug];

  return (
    <li className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-b-0 sm:px-4">
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-zinc-900">{label}</p>
      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-500">
        {formatAddonPrice(addon.amountCents)}
      </span>
      <DetailsToggleSwitch
        checked={checked}
        label={`${label} add-on`}
        onToggle={() => onToggle(slug, !checked)}
      />
      <span className="sr-only">{ADDON_STEP_DESCRIPTIONS[slug]}</span>
    </li>
  );
}

export function AddonsStepPanel({ serviceSlug, selected, onChange }: Props) {
  const displayOrder = getAddonStepDisplayOrder(serviceSlug);

  const toggleAddon = (slug: AddonSlug, enabled: boolean) => {
    if (enabled) {
      if (!selected.includes(slug)) {
        onChange([...selected, slug]);
      }
      return;
    }
    onChange(selected.filter((a) => a !== slug));
  };

  return (
    <section className={DETAILS_STEP_SECTION} aria-labelledby="addons-step-label">
      <DetailsSectionHeading title="Add-ons" id="addons-step-label" />

      <div
        className="overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-sm"
        role="group"
      >
        <ul className="m-0 list-none p-0">
          {displayOrder.map((slug) => (
            <AddonRow
              key={slug}
              slug={slug}
              label={getAddonStepLabel(slug, serviceSlug)}
              checked={selected.includes(slug)}
              onToggle={toggleAddon}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
