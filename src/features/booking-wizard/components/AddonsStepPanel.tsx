"use client";

import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug, ServiceSlug } from "@/features/pricing/server/types";
import { getAddonStepDescription, getAddonStepDisplayOrder, getAddonStepLabel } from "../addonStepDisplay";
import { getAddonsSectionHint, getAddonsSectionTitle } from "../airbnbCleaningDisplay";
import { DETAILS_OPTION_DESC, DETAILS_STEP_SECTION } from "../detailsStepUi";
import { formatAddonPrice } from "../format";
import { isOfficeCleaningSlug } from "../officeCleaningDisplay";
import { DetailsSectionHeading } from "./DetailsSectionHeading";
import { DetailsToggleSwitch } from "./DetailsToggleSwitch";
import { OfficeAddonsStepPanel } from "./OfficeAddonsStepPanel";

type Props = {
  serviceSlug: ServiceSlug | null;
  selected: AddonSlug[];
  onChange: (addons: AddonSlug[]) => void;
};

type AddonRowProps = {
  slug: AddonSlug;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (slug: AddonSlug, enabled: boolean) => void;
};

function AddonRow({ slug, label, description, checked, onToggle }: AddonRowProps) {
  const addon = ADDON_CATALOG[slug];
  const rowClass = checked ? "bg-shalean-soft-blue/40" : "bg-white";

  return (
    <li
      className={`flex min-w-0 items-center gap-2 border-b border-slate-100 px-2.5 py-2 last:border-b-0 sm:gap-2.5 sm:px-3 ${rowClass}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-shalean-navy">{label}</p>
        <p className={`${DETAILS_OPTION_DESC} line-clamp-2`}>{description}</p>
      </div>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500 sm:text-xs">
        {formatAddonPrice(addon.amountCents)}
      </span>
      <DetailsToggleSwitch
        checked={checked}
        label={`${label} add-on`}
        onToggle={() => onToggle(slug, !checked)}
      />
    </li>
  );
}

export function AddonsStepPanel({ serviceSlug, selected, onChange }: Props) {
  if (isOfficeCleaningSlug(serviceSlug)) {
    return <OfficeAddonsStepPanel selected={selected} onChange={onChange} />;
  }

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
      <DetailsSectionHeading
        title={getAddonsSectionTitle(serviceSlug)}
        id="addons-step-label"
      />
      {getAddonsSectionHint(serviceSlug) ? (
        <p className="mb-2 text-xs leading-snug text-slate-500">{getAddonsSectionHint(serviceSlug)}</p>
      ) : null}

      <div
        className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm"
        role="group"
        aria-labelledby="addons-step-label"
      >
        <ul className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2">
          {displayOrder.map((slug) => (
            <AddonRow
              key={slug}
              slug={slug}
              label={getAddonStepLabel(slug, serviceSlug)}
              description={getAddonStepDescription(slug, serviceSlug)}
              checked={selected.includes(slug)}
              onToggle={toggleAddon}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
