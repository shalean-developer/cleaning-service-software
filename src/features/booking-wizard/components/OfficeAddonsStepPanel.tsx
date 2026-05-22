"use client";

import { ADDON_CATALOG } from "@/features/pricing/server/catalog";
import type { AddonSlug } from "@/features/pricing/server/types";
import { getAddonStepDescription, getAddonStepLabel } from "../addonStepDisplay";
import {
  OFFICE_ADDON_STEP_GROUPS,
  OFFICE_CLEANING_SLUG,
} from "../officeCleaningDisplay";
import { getAddonsSectionHint, getAddonsSectionTitle } from "../airbnbCleaningDisplay";
import { DETAILS_STEP_SECTION } from "../detailsStepUi";
import { formatAddonPrice } from "../format";
import { DetailsSectionHeading } from "./DetailsSectionHeading";
import { DetailsToggleSwitch } from "./DetailsToggleSwitch";

const OFFICE_GROUP_HEADING =
  "px-2.5 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 first:pt-2.5 sm:px-3";

const OFFICE_ADDON_ROW =
  "flex min-w-0 items-center gap-2 border-b border-slate-100/90 px-2.5 py-1.5 last:border-b-0 sm:gap-2 sm:px-3";

type Props = {
  selected: AddonSlug[];
  onChange: (addons: AddonSlug[]) => void;
};

type OfficeAddonRowProps = {
  slug: AddonSlug;
  label: string;
  description: string;
  checked: boolean;
  onToggle: (slug: AddonSlug, enabled: boolean) => void;
};

function OfficeAddonRow({ slug, label, description, checked, onToggle }: OfficeAddonRowProps) {
  const addon = ADDON_CATALOG[slug];
  const rowClass = checked ? "bg-shalean-soft-blue/50" : "bg-white";

  return (
    <li className={`${OFFICE_ADDON_ROW} ${rowClass}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight text-shalean-navy">{label}</p>
        <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-500">{description}</p>
      </div>
      <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500 sm:text-xs">
        {formatAddonPrice(addon.amountCents)}
      </span>
      <DetailsToggleSwitch
        checked={checked}
        label={`${label} extra`}
        onToggle={() => onToggle(slug, !checked)}
      />
    </li>
  );
}

/** Compact, grouped office extras. display only; same selection contract as AddonsStepPanel. */
export function OfficeAddonsStepPanel({ selected, onChange }: Props) {
  const serviceSlug = OFFICE_CLEANING_SLUG;

  const toggleAddon = (slug: AddonSlug, enabled: boolean) => {
    if (enabled) {
      if (!selected.includes(slug)) {
        onChange([...selected, slug]);
      }
      return;
    }
    onChange(selected.filter((a) => a !== slug));
  };

  const sectionHint = getAddonsSectionHint(serviceSlug);

  return (
    <section className={`${DETAILS_STEP_SECTION} mb-3`} aria-labelledby="office-addons-step-label">
      <DetailsSectionHeading title={getAddonsSectionTitle(serviceSlug)} id="office-addons-step-label" />
      {sectionHint ? (
        <p className="mb-1.5 text-[11px] leading-snug text-slate-500 sm:text-xs">{sectionHint}</p>
      ) : null}

      <div
        className="overflow-hidden rounded-lg border border-slate-200/90 bg-white"
        role="group"
        aria-labelledby="office-addons-step-label"
      >
        {OFFICE_ADDON_STEP_GROUPS.map((group, groupIndex) => (
          <div
            key={group.id}
            className={groupIndex > 0 ? "border-t border-slate-100" : undefined}
            role="group"
            aria-label={group.title}
          >
            <p className={OFFICE_GROUP_HEADING}>{group.title}</p>
            <ul className="m-0 grid list-none grid-cols-1 p-0 sm:grid-cols-2">
              {group.slugs.map((slug) => (
                <OfficeAddonRow
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
        ))}
      </div>
    </section>
  );
}
